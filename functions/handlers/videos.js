const { db, admin } = require('../util/admin');
const { std, mean } = require('mathjs');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const { checkAssistantPermission, checkAdminPermission, checkCompletedTutorial, checkBannedUser } = require('../util/permissions');
const { validateVideoTitle } = require('../util/validators');

const maxRatings = 5;
const numOfDeviations = 3;
const numberOfAgreements = 3;

exports.submitVideoRating = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' });
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        admin.auth().getUser(decodedToken.uid)
        .then(userData => {
            if (checkBannedUser(userData.customClaims)) {
                return res.status(200).json({ message: 'Video rating added successfully' });
            } 
            if (!checkCompletedTutorial(decodedToken)) {
                return res.status(401).json({ message: 'Not authorized to add videos' }); 
            }
            const docQuery = db.doc(`/incomplete-videos/${ req.body.title }`)
            docQuery.get()
            .then(doc => {
                if (!doc.exists) {
                    return res.status(404).json({ message: 'Video has been reviewed or does not exist' });
                }
                let docData = doc.data();
                if (!docData.raters.includes(decodedToken.uid)) {
                    docData.raters[docData.raters.length] = decodedToken.uid;
                }
                docData.ratings[decodedToken.uid] = { added: Date.now(), rating: req.body.rating };
                Promise.all([
                    docQuery.set(docData),
                    recordVideoReview(decodedToken.uid, req.body.title), 
                    addToDate(),
                    db.doc('metadata/all-time-ratings').update({ length: FieldValue.increment(1) })
                ])
                .then(()=> {
                    this.checkAgreement(docData);
                    return res.status(200).json({ message: 'Video rating added successfully' });  
                })
            })
            .catch(err => {
                return res.status(401).json({ err: err });
            }) 
        })
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.reviewFlaggedVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateVideoTitle(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then(decodedToken => {
        if (checkAssistantPermission(decodedToken)) {
            db.doc(`/videos/${ req.body.title }`).get()
            .then(doc => {
                const data = doc.data();
                db.doc(`/${ data.location }/${ data.title }`).get().then((videoDoc) => {
                    const promises = [];
                    ['incomplete-videos', 'unusable-videos', 'flagged-videos', 'complete-videos'].forEach(location => {
                        if (data.location !== location) {
                            // cleaning up the database
                            promises.push(db.doc(`/${ location }/${ data.title }`).delete());
                        }
                    })
                    Promise.all(promises).then(() => {
                        const toCheck = videoDoc.data();
                        this.checkAgreement(toCheck).then(() => {
                            return res.status(200).json({ message: 'Successfully updated' });
                        })
                    })
                })
            })
            .catch(err => {
                console.log(err);
                return res.status(500).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to review flagged videos' }); 
        }
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

exports.checkAgreement = (checkVideo) => {
    return new Promise((resolve, reject) => {
        const averages = [];
        const ratingMap = {};
        const specialCases = [];
        let flagged = false;
        let unusable = false;
        if (checkVideo.raters.length < numberOfAgreements) {
            return resolve(); // too few raters
        }
        checkVideo.raters.forEach(rater => {
            const raterAverage = getRating(checkVideo.ratings[rater].rating)
            if (raterAverage < 0) {
                specialCases.push(raterAverage);
            } else {
                averages.push(raterAverage);
            }
            ratingMap[rater] = raterAverage;
        })

        let rejected = [];
        let accepted = [];
        if (averages.length >= numberOfAgreements) {
            const standardDev = std(averages, 'uncorrected');
            const mean1 = mean(averages);
            const upperRange = mean1 + (numOfDeviations * standardDev);
            let lowerRange = mean1 - (numOfDeviations * standardDev);
            if (lowerRange < 0) {
                lowerRange = 0;
            }
            checkVideo.raters.forEach(rater => {
                if (ratingMap[rater] < lowerRange || ratingMap[rater] > upperRange) {
                    rejected.push(rater);
                } else {
                    accepted.push(rater);
                }
            })
        } 
        /*
        if there are less than 3 accepted and there are special cases check agreement
        */
        if (accepted.length < numberOfAgreements && specialCases.length >= numberOfAgreements) {
            accepted = [];
            rejected = [];
            let numBadQuality = 0;
            let numNoBubbles = 0;
            specialCases.forEach(rating => {
                numBadQuality++;
            })

            let acceptedRating = 0;
            if (numNoBubbles >= numberOfAgreements) {
                unusable = true;
                acceptedRating = -2;
            } else if (numBadQuality >= numberOfAgreements) {
                unusable = true;
                acceptedRating = -3;
            }

            if (acceptedRating === 0 && numBadQuality >= numberOfAgreements) {
                unusable = true;
                checkVideo.raters.forEach(rater => {
                    if (ratingMap[rater] === -3 || ratingMap[rater] === -1) {
                        accepted.push(rater);
                    } else {
                        rejected.push(rater);
                    }
                })
            } else if (acceptedRating !== 0) {
                checkVideo.raters.forEach(rater => {
                    if (ratingMap[rater] === acceptedRating) {
                        accepted.push(rater);
                    } else {
                        rejected.push(rater);
                    }
                })
            } 
        }
        // if not agree by now send off to be flagged 
        // need logic for that 
        if (accepted.length < numberOfAgreements && checkVideo.raters.length >= maxRatings) {
            flagged = true;
        }

        const promises = [];

        let location = 'incomplete';
        if (flagged) {
            location = 'flagged';
        } else if (unusable) {
            location = 'unusable';
        } else if (accepted.length >= numberOfAgreements && !unusable) {
            location = 'complete';
        }
        console.log(location);
        if (!flagged && location !== 'incomplete') {
            rejected.forEach(user => {
                const rejectedRating = { rating: checkVideo.ratings[user].rating, video: checkVideo.title, date: checkVideo.ratings[user].added };
                promises.push(new Promise((resolve, reject) => {
                    db.doc(`/users/${ user }`).get().then(data => {
                        const doc = data.data();
                        doc.rejectedRatings.push(rejectedRating);
                        doc.outliers += 1;
                        db.doc(`/users/${ user }`).set(doc)
                        .then(() => {
                            resolve();
                        })
                    })
                    .catch(err => {
                        reject(err);
                    }) 
                }));
            });

            checkVideo.raters = accepted;
            acceptedRatings = {};
            accepted.forEach(rater => {
                acceptedRatings[rater] = checkVideo.ratings[rater];
            })
            checkVideo.ratings = acceptedRatings;
            accepted.forEach((user) => {
                promises.push(db.doc(`/users/${ user }`).update({ userScore: FieldValue.increment(10), accepted:  FieldValue.increment(1) }));
            })
        }
        promises.push(changeLocation(location, checkVideo))
        Promise.all(promises).then(() => {
            resolve();
        }) 
        .catch(err => {
            reject(err);
        })
    })
}

exports.updateCount  = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }


    if (!req.body.location) {
        return res.status(400).json({ message: 'Must have a location field' });
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            db.collection(req.body.location).get()
            .then(data => {
                let count = 0;
                data.forEach(doc => {
                    count++;
                })
                db.doc(`/metadata/${ req.body.location }`).update({ length: count }).then(() => {
                    return res.status(200).json({ message: 'Successfully updated' });
                })
            })
            .catch(err => {
                console.log(err);
                return res.status(500).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to review flagged videos' }); 
        }
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

const changeLocation = (newLocation, videoDoc) => {
    console.log(videoDoc)
    return new Promise((resolve, reject) => {
        if (`${ newLocation }-videos` === videoDoc.location) {

           return resolve(); 
        } else {
            const promises = [];
            const location = videoDoc.location;
            console.log('firstLocation: ', location)
            videoDoc.location = `${ newLocation }-videos`;
            console.log('change location');
            promises.push(db.doc(`/videos/${ videoDoc.title }`).update({ location: `${ newLocation }-videos` }));
            promises.push(db.doc(`/${ newLocation }-videos/${ videoDoc.title }`).set(videoDoc));
            promises.push(db.doc(`/metadata/${ location }`).update({ length: FieldValue.increment(-1) }));
            promises.push(db.doc(`/metadata/${ newLocation }-videos/`).update({ length: FieldValue.increment(1) }));
            Promise.all(promises).then(() => {
                db.doc(`/${ location }/${ videoDoc.title }`).delete().then(() => {
                    return resolve();
                })
            })
            .catch(err => {
                reject(err);
            })
        }
        
    });
}

const getRating = (rating) => {
    if (rating.length === 1 && rating[0].frame === -1) {
        const bubble = rating[0];
        if (bubble.x === -1 && bubble.y === -1) {
            return -1;
        } else if (bubble.x === -2 && bubble.y === -2) {
            return -2;
        } else if (bubble.x === -3 && bubble.y === -3) {
            return -3;
        }
    }
    
    let emptyFrames = 0;
    const frames = [];
    rating.forEach(bubble => {
        if (!frames.includes(bubble.frame)) {
            frames.push(bubble.frame);
        }
        if (bubble.x === -2 && bubble.y === -2) {
            emptyFrames += 1;
        }
    });
    const average = (rating.length - emptyFrames) / frames.length;
    return average;
}

const addToDate = () => {
    const d = new Date(Date.now());
    let day = d.toLocaleDateString().toString();
    day = day.replace(/\//g, '.');
    return new Promise((resolve, reject) => { // go in there and see if I can find it 
        db.doc(`/ratingsPerDay/${ day }`).get()
        .then(doc => {
            if (!doc.exists) {
                db.doc(`/ratingsPerDay/${ day }`).set({ date: Date.now(), day, ratings: 1 }).then(() => {
                    resolve();
                });
            } else {
                const data = doc.data();
                doc.ref.update({ ratings: data.ratings + 1 }).then(() => {
                    resolve();
                });
            }
        })
        .catch((err) => {
            reject(err);
        })
    })
}

const recordVideoReview = (uid, video) => {
    return new Promise((resolve, reject) => {
        db.doc(`/users/${ uid }`).get()
        .then((data)=> {
            const doc = data.data();
            if (!doc.videosRated.includes(video)) {
                doc.videosRated.push(video);
            }
            doc.videosReviewed += 1;
            doc.userScore += 1;
            db.doc(`/users/${ uid }`).set(doc)
            .then(() => {
                resolve();
            });
        })
        .catch(err => {
            reject(err);
        })
    })
}
