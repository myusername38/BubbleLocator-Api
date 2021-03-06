const { admin, db } = require('../util/admin');
const FieldValue = admin.firestore.FieldValue;

const { validateVideo, validateGetExpandedVideoData, validateTutorialVideo, validateDeleteRating, validateVideoTitle } = require('../util/validators')
const { checkAssistantPermission, checkAdminPermission, checkOwnerPermission, checkCompletedTutorial } = require('../util/permissions');

const videosAtOnce = 15;

exports.addVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }
    const { valid, errors } = validateVideo(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let url = req.body.url;
    if (url.substring(0, 26) !== 'https://www.dropbox.com/s/') {
        return res.status(403).json({ message: 'Videos must be from dropbox' })
    }
    
    let id = url.substring(42, url.length - 6);

    if (url.substring(url.length - 5, url.length) !== 'raw=1') {
        id = url.substring(42, url.length - 5);
        url = url.substring(0, url.length - 5) + '?raw=1'
    }
    id = id.replace(/%20/g, '_');

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (!checkAssistantPermission(decodedToken)) {
            return res.status(401).json({ message: 'Not authorized to add videos' }); 
        }
        db.doc(`/videos/${ id }`).get()
        .then(doc => {
            if (doc.exists) {
                return res.status(406).json({ message: `The video already exists in ${ doc.data().location }` });
            } else {
                Promise.all([
                    db.doc(`/incomplete-videos/${ id }`).set({ 
                        title: id,
                        added: Date.now(),
                        user: decodedToken.email,
                        raters: [],
                        ratings: {},
                        fps: 30,
                        url 
                    }),
                    db.doc(`/videos/${ id }`).set({ 
                        title: id,
                        added: Date.now(),
                        user: decodedToken.email,
                        location: 'incomplete-videos',
                        fps: 30,
                        url,
                    }),
                    db.doc(`/metadata/incomplete-videos`).update({ length: FieldValue.increment(1) }),
                    db.doc('/metadata/videos-added').update({ length: FieldValue.increment(1) })
                ]).then(()=> {  
                    res.status(200).json({ message: 'Video Added' }); 
                })
            }
        })      
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

exports.addTutorialVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }
    
    const { valid, errors } = validateTutorialVideo(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let url = req.body.url;
   
    let id = url.substring(42, url.length - 5); 

    url = url.substring(0, url.length - 5) + '?raw=1'

    let noBubbles = false; 
    let washOut = false;

    if (req.body.noBubbles) {
        noBubbles = true;
    }

    if (req.body.washOut) {
        washOut = true;
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            Promise.all([
                db.doc(`/tutorial-videos/${ id }`).set({ 
                    title: id,
                    added: Date.now(),
                    user: decodedToken.email,
                    status: 'tutorial',
                    average: req.body.average,
                    stdev: req.body.stdev,
                    fps: req.body.fps,
                    noBubbles,
                    washOut,
                    badQuality,
                    url
                }),
                db.doc(`/videos/${ id }`).set({ 
                    title: id,
                    added: Date.now(),
                    user: decodedToken.email,
                    location: 'tutorial-videos',
                    url
                }),
                db.doc(`/metadata/tutorial-videos`).update({ length: FieldValue.increment(1) }),
            ])
            .then(()=> {  
                res.status(200).json({ message: 'Video Added' }); 
            })  
        }
        else {
            return res.status(401).json({ message: 'Not authorized to add tutorial videos' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.getTutorialVideos = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            db.collection('/tutorial-videos')
            .get()
            .then(data => {
                let videos = [];
                data.forEach((doc) => {
                    videos[videos.length] = doc.data();
                })
                return res.status(200).json(videos);
            });
        }
        else {
            return res.status(401).json({ message: 'Not authorized to get video data' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

/*Think I might redo this */
exports.getExpandedVideoData = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateGetExpandedVideoData(req.body.uid);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let locaiton = null;

    if (req.body.location) {
        if (location === 'tutorial-videos' || locaiton === 'incomplete-videos' || location === 'completed-videos') {
            location = req.body.location;
        }
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAssistantPermission(decodedToken)) {
            if (location) {
                db.doc(`/${ locaiton }/${ req.body.title }`).get()
                .then((doc) => {
                    return res.status(200).json(doc.data());
                })
            } else {
                db.doc(`/videos/${ req.body.title }`).get()
                .then((doc) => {
                    location = doc.data().location
                    db.doc(`/${ locaiton }/${ req.body.title }`).get()
                    .then((doc) => {
                        return res.status(200).json(doc.data());
                    })
                })
            }
        }
        else {
            return res.status(401).json({ message: 'Not authorized to get video data' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.getReviewVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkCompletedTutorial(decodedToken)) {
            getVideoUrl(null, decodedToken.uid, 0).then(video => {
                if (video && video.url) {
                    return res.status(200).json({
                        title: video.title,
                        fps: video.fps,
                        url: video.url
                    });
                } else {
                    return res.status(404).json({ message: 'No more videos to review'});  
                }
            })
        } else {
            return res.status(401).json({ message: 'Complete tutorial to review videos' });
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.getTutorialVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        db.doc(`/users/${ decodedToken.uid }`).get()
        .then(doc => {
            getTutorialVideoUrl(doc.data()).then(video => {
                if (video && video.url) {
                    return res.status(200).json({
                        title: video.title,
                        fps: video.fps,
                        url: video.url,
                        noBubbles: video.noBubbles,
                        washOut: video.washOut,
                        badQuality: video.badQuality,
                    });
                } else {
                    return res.status(404).json({ message: 'No more videos to review'});  
                }
            })
        })
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

/* Need to add thing */

exports.deleteVideoRating = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateDeleteRating(req.query);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAssistantPermission(decodedToken)) {
            const query = db.doc(`/${ req.query.location }-videos/${ req.query.title }`);
            query.get()
            .then(doc => {
                const docData = doc.data();
                const ratings = {};
                docData.raters = docData.raters.filter(rater => rater !== req.query.uid);
                docData.raters.forEach(rater => {
                    ratings[rater] = docData.ratings[rater];
                })
                docData.ratings = ratings;
                Promise.all([
                    query.set(docData),
                    deleteVideoFromUsers(req.query.title)
                ])
                .then(() => {
                    res.status(200).json({ message: 'Rating deleted' });
                })
            })
            .catch(err => {
                console.log(err);
                return res.status(500).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to add videos' }); 
        }
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

exports.getVideoRatings = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }
    
    const { valid, errors } = validateVideoTitle(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }
    
    const title = req.body.title;

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAssistantPermission(decodedToken)) {
            let incomplete = null;
            let complete = null;
            Promise.all([
                db.doc(`/incomplete-videos/${ title }`).get().then(doc => {
                    if (doc.exists) {
                        incomplete = doc.data();
                    }
                    return;
                }),
                db.doc(`/complete-videos/${ title }`).get().then(doc => {
                    if (doc.exists) {
                        complete = doc.data();
                    }
                    return;
                }),
            ])
            .then(() => {
                if (complete) {
                    const ratings = [];
                    complete.raters.forEach(rater => {
                        if (complete.ratings[rater]) {
                            ratings.push(complete.ratings[rater].rating);
                        }
                    })
                    return res.status(200).json({ ratings })    
                } else if (incomplete) {    
                    const ratings = [];
                    incomplete.raters.forEach(rater => {
                        if (incomplete.ratings[rater]) {
                            ratings.push(incomplete.ratings[rater].rating);
                        }
                    })
                    return res.status(200).json({ ratings })     
                } else {
                    return res.status(404).json({ message: 'Video does not exist' }); 
                }
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to get videos' }); 
        }
    })
    .catch((err) => {
        return res.status(500).json({ err: err }); 
    });
}

exports.getAllCompleteVideos = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkOwnerPermission(decodedToken) || decodedToken.email === 'dle4@email.unc.edu') {
            db.collection('complete-videos')
            .get()
            .then(data => {
                let videos = [];
                data.forEach(doc => {
                    videos.push(doc.data());
                });
                return res.status(200).json(videos);    
            });
        } else {
            return res.status(401).json({ message: 'Not authorized to get all completed videos' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.resetVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' });
    }

    const { valid, errors } = validateVideoTitle(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (!checkAssistantPermission(decodedToken)) {
            return res.status(401).json({ message: 'Not authorized to get all completed videos' }); 
        }
        let video = null;
        db.doc(`/videos/${ req.body.title }`).get().then(doc => {
            if (!doc.exists) {
                res.status(404).json({ message: 'Video does not exist' });
            } 
            video = doc.data();
            if (video.location === 'tutorial-videos') {
                res.status(403).json({ message: 'Cannot reset tutorial videos' });
            }
            db.doc(`/${ video.location }/${ video.title }`).get().then(doc => {
                if (!doc.exists) {
                    res.status(500).json({ message: 'Database got out of line. Please contact database owner and report this video' });
                }
                videoData = doc.data();
                const promises = [];
                promises.push(db.doc(`/videos/${ video.title }`).update({ location: 'incomplete-videos' }));
                if (video.location !== 'incomplete-videos') {
                    promises.push(db.doc(`/complete-videos/${ video.title }`).delete());
                    promises.push(db.doc(`/unusable-videos/${ video.title }`).delete());
                    promises.push(db.doc(`/flagged-videos/${ video.title }`).delete());
                }
                promises.push(deleteVideoFromUsers(video.title));
                video.raters = [];
                video.ratings = {};
                video.location = 'incomplete-videos';
                promises.push(db.doc(`/incomplete-videos/${ video.title }`).set(video));
                Promise.all(promises).then(() => {
                    return res.status(200).json({ message: 'Video reset' });  
                })
            })
        })
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.deleteVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }
    
    const { valid, errors } = validateVideoTitle(req.query);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let title = req.query.title;
    title = title.replace(' ', '%20');
    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            const promises = [];
            promises.push(db.doc(`/metadata/${ req.query.location }-videos`).update({ length: FieldValue.increment(-1) }));
            promises.push(db.doc('/metadata/videos-added').update({ length: FieldValue.increment(-1) }));
            promises.push(deleteVideoFromUsers(title));
            promises.push(db.doc(`/incomplete-videos/${ title }`).delete());
            promises.push(db.doc(`/complete-videos/${ title }`).delete());
            promises.push(db.doc(`/tutorial-videos/${ title }`).delete());
            promises.push(db.doc(`/unusable-videos/${ title }`).delete());
            promises.push(db.doc(`/flagged-videos/${ title }`).delete());
            promises.push(db.doc(`/videos/${ title }`).delete());
            Promise.all(promises)
            .then(() => {
                res.status(200).json({ message: 'Video deleted successfully' })
            })
            .catch((err) => {
                return res.status(500).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to delete videos' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.getVideo = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }
    
    const { valid, errors } = validateVideoTitle(req.query);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let title = req.query.title;
    title = title.replace(' ', '%20');
    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAssistantPermission(decodedToken)) {
            db.doc(`/videos/${ title }`).get().then(doc => {
                if (doc.exists) {
                    const docData = doc.data();
                    db.doc(`${ docData.location }/${ docData.title }`).get().then(doc => {
                        const video = doc.data();
                        video.location = docData.location;
                        return res.status(200).json({ video }); 
                    });
                } else {
                    return res.status(404).json({ err: 'Video does not exist' });
                }
            })
            .catch((err) => {
                return res.status(500).json({ err: err });
            });
        } else {
            return res.status(401).json({ message: 'Not authorized to search videos' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

const setVideoLocation = (user, title, location, video) => {
    return new Promise((resolve, reject) => {
        db.doc(`/videos/${ title }`).get().then(doc => {
            if (doc.exists) {
                doc.set({ 
                    title: doc.id,
                    added: Date.now(),
                    user,
                    location,
                    url: doc.url
                })
                .then(() => {
                    resolve();
                })
            }
        })
        .catch(err => {
            reject(err);
        })
    })
} 

const getVideoUrl = (previousDoc, uid, levels) => {
    if (levels > 1000) {
        return ({ message: 'Infinite loop' }); //in an infinite loop
    }
    let request = db.collection('/incomplete-videos').orderBy('added', 'asc').limit(videosAtOnce)

    if (previousDoc) {
        request = request.startAfter(previousDoc); // paginating the data
    }
    return new Promise((resolve, reject) => {
        request.get()
        .then(data => {
            let videos = [];
            let lastDoc = null;
            data.forEach((doc) => {
                lastDoc = doc; // getting the last doc to pagniate the data
                videos[videos.length] = doc.data();
            })
            const shuffledIndex = getShuffledIndexes(videos.length);
            shuffledIndex.forEach(i => {
                if (!videos[i].raters.includes(uid)) {
                    resolve(videos[i]); // making sure the rater has not seen this video before
                }
            })
            if (videos.length === videosAtOnce) {
                getVideoUrl(lastDoc, uid, levels + 1).then(data => {
                    resolve(data); //returning the video the rater one its found
                }).catch(err => {
                    reject(err);
                })
            } else {
                return resolve({ message: 'No more videos to review' }); //
            }
        })
        .catch(err => {
            reject(err);
        })
    })
}

const getShuffledIndexes = (length) => {
    let indexArray = []
    for (let i = 0; i < length; i++) {
        indexArray[indexArray.length] = i;
    }
    for (let i = indexArray.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        const temp = indexArray[i];
        indexArray[i] = indexArray[j];
        indexArray[j] = temp;
    }
    return indexArray;
}

const deleteVideoFromUsers = (title) => {
    return new Promise((resolve, reject) => { // go in there and see if I can find it 
        db.collection('users').where('videosRated', 'array-contains', title).get()
        .then(data => {
            const promises = [];
            data.forEach(user => {
                let userData = user.data();
                userData.videosRated = userData.videosRated.filter(video => video !== title);
                promises.push(user.ref.set(userData));
            });
            Promise.all(promises)
            .then(() => {
                resolve();
            });
        })
        .catch((err) => {
            reject(err);
        })
    })
}

const getVideo = (title) => {
    return new Promise((resolve, reject) => { // go in there and see if I can find it 
        let incomplete = null;
        let complete = null;
        console.log(title);
        db.doc(`/incomplete-videos/${ title }`).get().then(doc => {
            console.log(doc.data());
        })
    })
}

const getTutorialVideoUrl = (userData) => {
    let request = db.collection('/tutorial-videos').orderBy('added', 'asc');

    const tutorialVideosViewed = userData.tutorialRatings.map(r => r.video);

    return new Promise((resolve, reject) => {
        request.get()
        .then(data => {
            let videos = [];
            data.forEach((doc) => {
                lastDoc = doc; // getting the last doc to pagniate the data
                videos[videos.length] = doc.data();
            })
            const shuffledIndex = getShuffledIndexes(videos.length);
            shuffledIndex.forEach(i => {
                if (!tutorialVideosViewed.includes(videos[i].title)) {
                    return resolve(videos[i]); // making sure the rater has not seen this video before
                }
            })
            return resolve(videos[shuffledIndex[0]]); //sending a random video when ready
        })
        .catch(err => {
            reject(err);
        })
    })            
}
