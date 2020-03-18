const { admin, db } = require('../util/admin');

const { validateUserToken, validateVideo, validateGetExpandedVideoData, validateTutorialVideo } = require('../util/validators')

const videosAtOnce = 10;

exports.addVideo = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    const { valid, errors } = validateVideo(req.body.uid);

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

    url = url.substring(0, url.length - 5) + 'raw=1'

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
            (decodedToken.assistant && decodedToekn.assistant === true)) {
            db.doc(`/incomplete-videos/${ id }`).set({ 
                title: id,
                added: Date.now(),
                user: decodedToken.email,
                status: 'incomplete',
                fps: req.body.fps,
                url 
            })
            .then(() => {
                db.doc(`/videos/{ id }`).set({ 
                    title: id,
                    added: Date.now(),
                    user: decodedToken.email,
                    location: 'incomplete-videos',
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
            (decodedToken.assistant && decodedToekn.assistant === true)) {
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

exports.getVideoData = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    let offset = 0;
    if (req.query.offset) {
        offset = req.query.offset;
        if (offset < 0) {
            offset = 0;
        }
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if ((decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
            (decodedToken.assistant && decodedToekn.assistant === true)) {
            if (offset !== 0) {
                db.collection('/videos')
                .offset(offset)
                .limit(25)
                .get()
                .then(data => {
                    let videos = [];
                    data.forEach((doc) => {
                        videos[videos.length] = doc.data();
                    })
                    return res.status(200).json(videos);
                });
            } else {
                db.collection('/videos')
                .limit(25)
                .get()
                .then(data => {
                    let videos = [];
                    data.forEach((doc) => {
                        videos[videos.length] = doc.data();
                    })
                    return res.status(200).json(videos);
                });
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
        const { valid, errors } = validateUserToken(decodedToken);

        if (!valid) {
            // return res.status(401).json(errors);
        }

        db.collection('/incomplete-videos')
        .limit(videosAtOnce)
        .get()
        .then(data => {
            const randomNumber = Math.floor(Math.random() * videosAtOnce);
            let videos = [];
            data.forEach((doc) => {
                videos[videos.length] = doc.data();
            })
            const videoData = { url: videos[randomNumber].url, fps: videos[randomNumber].fps };
            return res.status(200).json(videoData);
        })
    })
}

exports.submitVideoRating = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' });
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (decodedToken.completedTutorial && decodedToken.completedTutorial === true) {
            let ratingData = '';
            try {
                ratingData = JSON.stringify(req.body.ratingData);
            } catch (err) {
                if (err instanceof SyntaxError) {
                    return res.status(400).json({ message: 'ratingData must be in a json format' });
                } else {
                    return res.status(500).json({ message: 'Unknown error' });
                }
            }
            
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


