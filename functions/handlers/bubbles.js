const { admin, db } = require('../util/admin');

exports.getVideo = (req, res) => {
    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        res.status(200).json({ worked: decodedToken });    
    }).catch((error) => {
        res.status(400).json({ noWork: ':('});    
    });
}

exports.addVideo = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    if (!req.body.url) {
        return  res.status(400).json({ message: 'Must have a url' }); 
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
            db.doc(`/videos/${ id }`).set({ 
                title: id,
                added: Date.now(),
                user: decodedToken.email,
                status: 'incomplete',
                url 
            })
            .then(() => {
                res.status(200).json({ message: 'Video Added' }); 
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

exports.getVideoData = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    let offset = 0;
    if (req.query.offset) {
        offset = req.query.offset;
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
