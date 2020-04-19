const { admin, db } = require('../util/admin');

const { validateUserToken, validateVideo, validateGetExpandedVideoData, validateTutorialVideo, validateDeleteRating, validateVideoTitle } = require('../util/validators')

const videosAtOnce = 15;

exports.addVideo = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateVideo(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let url = req.body.url;
    if (url.substring(0, 26) !== 'https://www.dropbox.com/s/') {
        return res.status(403).json({ message: 'Videos must be from dropbox' })
    }
    if (url.substring(url.length - 4, url.length) !== 'dl=0') {
        return res.status(403).json({ message: 'Video url must end with dl=0' })
    } 

    let id = url.substring(42, url.length - 5);

    url = url.substring(0, url.length - 5) + '?raw=1'

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
            (decodedToken.assistant && decodedToekn.assistant === true)) {
            db.doc(`/incomplete-videos/${ id }`).set({ 
                title: id,
                added: Date.now(),
                user: decodedToken.email,
                ratings: 0,
                fps: req.body.fps,
                url 
            })
            .then(() => {
                db.doc(`/videos/${ id }`).set({ 
                    title: id,
                    added: Date.now(),
                    user: decodedToken.email,
                    location: 'incomplete-videos',
                    fps: req.body.fps,
                    url,
                }).then(()=> {  
                    res.status(200).json({ message: 'Video Added' }); 
                })  
            })
        }
        else {
            return res.status(401).json({ message: 'Not authorized to add videos' }); 
        }
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

exports.addTutorialVideo = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    
    const { valid, errors } = validateTutorialVideo(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    let url = req.body.url;
   
    let id = url.substring(42, url.length - 5);

    url = url.substring(0, url.length - 5) + 'raw=1'

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
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true)) {
            db.doc(`/tutorial-videos/${ id }`).set({ 
                title: id,
                added: Date.now(),
                user: decodedToken.email,
                status: 'tutorial',
                ceiling: req.body.ceiling,
                floor: req.body.floor,
                fps: req.body.fps,
                noBubbles,
                washOut,
                url
            })
            .then(() => {
                db.doc(`/videos/${ id }`).set({ 
                    title: id,
                    added: Date.now(),
                    user: decodedToken.email,
                    location: 'tutorial-videos',
                    url
                }).then(()=> {  
                    res.status(200).json({ message: 'Video Added' }); 
                })  
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
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true)) {
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
        return  res.status(400).json({ message: 'Must have a token' }); 
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
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
            (decodedToken.assistant && decodedToken.assistant === true)) {
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
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (decodedToken.completedTutorial === true) {
            getVideoUrl(null, decodedToken.email, 0).then(video => {
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
/* Need to add thing */
exports.submitVideoRating = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' });
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (decodedToken.completedTutorial && decodedToken.completedTutorial === true) {
            const docQuery = db.doc(`/incomplete-videos/${ req.body.title }`)
            docQuery.get()
            .then(doc => {
                let docData = doc.data();
                if (!docData.raters.includes(decodedToken.uid)) {
                    docData.raters[docData.raters.length] = decodedToken.uid;
                }
                docData.ratings[decodedToken.uid] = { added: Date.now(), rating: req.body.rating };
                Promise.all([docQuery.set(docData), recordVideoReview(decodedToken.uid, req.body.title)])
                .then(()=> {
                    return res.status(200).json({ message: 'Video rating added successfully'});  
                })
            })
            .catch(err => {
                return res.status(401).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to add videos' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.deleteVideoRating = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateDeleteRating(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
            (decodedToken.assistant && decodedToken.assistant === true)) {
            const docQuery = db.doc(`/incomplete-videos/${ req.body.title }`)
            
            .catch(err => {
                return res.status(401).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to add videos' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err: err }); 
    });
}

exports.getVideoRatings = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    
    const { valid, errors } = validateVideoTitle(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }
    
    const title = req.body.title;

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
            (decodedToken.assistant && decodedToken.assistant === true)) {
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

exports.setVideo = (req, res) => {
    db.doc('/incomplete-videos/VIDEO-02%2003_05_09_12_11_19.mp4').get().then(data => {
        checkAgreement(data.data());
    })
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

const recordVideoReview = (uid, video) => {
    return new Promise((resolve, reject) => {
        db.doc(`/users/${ uid }`).get()
        .then((data)=> {
            const doc = data.data();
            if (!doc.videosRated.includes(video)) {
                doc.videosRated.push(video);
            }
            db.doc(`/users/${ uid }`).set(doc)
            .then(() => {
                resolve();
            })
        })
        .catch(err => {
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
