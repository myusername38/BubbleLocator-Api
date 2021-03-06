const { admin, db } = require('../util/admin');

const { validateSignupData, validateLoginData, validateUid, validateEmail, validateTutorialRating } = require('../util/validators');
const { checkAssistantPermission, checkAdminPermission, checkOwnerPermission, checkCompletedTutorial, checkBannedUser } = require('../util/permissions');

const config = require('../config');
const firebase = require('firebase');
firebase.initializeApp(config);
const tutorialAcceptableStdev = 2;
const tutorialVideosToComplete = 4;
const FieldValue = require('firebase-admin').firestore.FieldValue;

exports.signup = (req, res) => {
    const newUser = {
        email: req.body.email, 
        password: req.body.password,
    };

    const { valid, errors } = validateSignupData(newUser);
    
    if (!valid) {
        return res.status(400).json(errors);
    }
    /*
    db.doc('/whitelist/allow-registration').get().then(doc => {
        if (!doc.data().emails.includes(newUser.email)) {
            return res.status(400).json({ email: 'Email is not whitelisted' });   
        }
    .then(() => {
    */
        firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
        .then((data) => {
            Promise.all([
                admin.auth().setCustomUserClaims(data.user.uid, {
                    assistant: false,
                    admin: false,
                    owner: false,
                    completedTutorial: false,
                    banned: false,
                }),
                db.doc(`/users/${ data.user.uid }`).set({
                    userScore: 0, 
                    videosReviewed: 0, 
                    accepted: 0,
                    outliers: 0,
                    videosRated: [],
                    tutorialRatings: [],
                    rejectedRatings: [],
                    role: 'rater',
                    uid: data.user.uid
                }),
                db.doc(`/metadata/users`).update({ length: FieldValue.increment(1) }),
            ])
            .then(() => {
                return res.status(201).json({ message: `${ req.body.email } is now signed up`})
            })
        // })
    })
    .catch(err => {
        console.error(err);
        if (err.code === 'auth/email-already-in-use'){
            console.log('here')
            return res.status(400).json({ email: 'Email is already in use'});    
        } else {
        return res.status(500).json({ error: err.code });
        } 
    });
    
}

exports.login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };
    console.log(user);

    const { valid, errors } = validateLoginData(user);

    if (!valid) {
        return res.status(400).json(errors);
    }

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
        return data.user.getIdToken();
    })
    .then(token => {
        return res.json({ token });
    })
    .catch(err => {
        console.error(err);
        if (err.code === 'auth/wrong-password'){
            return res.status(403).json({ general: 'Wrong credentials, please try again' });
        } else return res.status(500).json({ error: err.code });
    });
}

exports.deleteUser = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateUid(req.query.uid);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            admin.auth().getUser(req.query.uid)
            .then((user) => {
                if (!checkOwnerPermission(decodedToken)) { // Owners can do anything
                    if (checkAssistantPermission(user.customClaims)) {
                        return res.status(401).json({ message: 'Can only delete raters' });
                    }
                } 
                Promise.all([
                    admin.auth().deleteUser(user.uid),
                    removeUserMetadata(user.uid, true),
                    removeAllUserRatings(user.uid),
                    db.doc(`/metadata/users`).update({ length: FieldValue.increment(-1) }),
                    admin.auth().revokeRefreshTokens(user.uid),
                    db.doc(`/users/${ user.uid }`).delete()
                ])
                .then(() => {
                        return res.status(200).json({ message: `${ user.uid } has been deleted` });
                })
            })
            .catch((err) => {
                // making sure all the user data is deleted
                if (err.code === 'auth/user-not-found') {
                    Promise.all([
                        removeUserMetadata(req.query.uid, true),
                        removeAllUserRatings(req.query.uid)
                    ])
                    .then(() => {
                        return res.status(404).json({ message: 'User does not exist' }); 
                    })
                } else {
                    console.log(err);
                    return res.status(500).json({ err: err }); 
                }
            });
        }
        else {
            return res.status(401).json({ message: 'Not authorized to delete users' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.removeUserAccount = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then(decodedToken => {
        Promise.all([
            admin.auth().deleteUser(decodedToken.uid),
            removeUserMetadata(decodedToken.uid),
            removeAllUserRatings(decodedToken.uid, false),
            db.doc(`/metadata/users`).update({ length: FieldValue.increment(-1) }),
            db.doc(`/users/${ decodedToken.uid }`).delete()
        ])
        .then(() => {
            return res.status(200).json({ message: `${ decodedToken.uid } has been deleted` });
        })
        .catch((err) => {
            // making sure all the user data is deleted
            if (err.code === 'auth/user-not-found') {
                Promise.all([
                    removeUserMetadata(decodedToken.uid, false),
                    removeAllUserRatings(decodedToken.uid),
                    admin.auth().revokeRefreshTokens(decodedToken.uid),
                ])
                .then(() => {
                    return res.status(404).json({ message: 'User does not exist' }); 
                })
            } else {
                console.log(err);
                return res.status(500).json({ err: err }); 
            }
        });
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.getUidFromEmail = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateEmail(req.query);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (checkAssistantPermission(decodedToken)) {
            admin.auth().getUserByEmail(req.query.email)
            .then(user => {
                return res.json({ uid: user.uid })
            })
            .catch((err) => {
                if (err.code && err.code === 'auth/user-not-found') {
                    return res.status(404).json({ message: 'User not found' })
                }
                return res.status(500).json({ err: err }); 
            });
        }
        else {
            return res.status(401).json({ message: 'Not authorized to get Uid' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.grantAssistant = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateUid(req.body.uid);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                if (!(decodedToken.owner && decodedToken.owner === true)) { // Owners can do anything
                    if (decodedToken.admin && decodedToken.admin === true && user.customClaims.admin && user.customClaims.admin === true) {
                        return res.status(406).json({ message: 'Admins cannot set admins to assistants.' }); 
                    } else if (decodedToken.admin && decodedToken.admin === true && user.customClaims.owner && user.customClaims.owner === true) {
                        return res.status(406).json({ message: 'Admins cannot set admins to assistants.' }); 
                    }
                } 
                changePermission(user, 'assistant', decodedToken.uid)
                .then(() => {
                    return res.status(200).json({ message: `${ user.email } is now an admin` })
                })
            })
        }
        else {
            return res.status(401).json({ message: 'Not authorized to add assistant' }); 
        }
    })
    .catch((err) => {
        return res.status(500).json({ err }); 
    });
};

exports.grantAdmin = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateUid(req.body.uid);

    if (!valid) {
        return res.status(400).json(errors);
    }
    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                changePermission(user, 'admin',  decodedToken.uid)
                .then(() => {
                    console.log('there');
                    return res.status(200).json({ message: `${ user.email } is now an admin` })
                })
            }).catch((err) => {
                return res.status(500).json({ err: err }); 
            });
        }
        else {
            return res.status(401).json({ message: 'Not authorized to add admin' }); 
        }
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err }); 
    });
};

exports.grantOwner = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateUid(req.body.uid);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                changePermission(user, 'owner', decodedToken.uid)
                .then(() => {
                    return res.status(200).json({ message: `${ user.email } is now an owner` })
                })
            }).catch((err) => {
                console.log(err);
                return res.status(500).json({ err: err }); 
            });
        }
        else {
            return res.status(401).json({ message: 'Not authorized to add owner' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.getAssistants = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            db.collection('/user-roles/roles/assistants')
            .get()
            .then(data => {
                let assistants = [];
                data.forEach((doc) => {
                    assistants[assistants.length] = doc.data();
                })
                return res.status(200).json(assistants);
            })
            .catch(err => {
                return res.status(500).json(err);
            })
        }
        else {
            return res.status(401).json({ message: 'Not authorized to get Assistants' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.getAdmins = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        console.log(decodedToken);
        if (decodedToken.owner && decodedToken.owner === true) {
            db.collection('/user-roles/roles/admins')
            .get()
            .then(data => {
                let admins = [];
                data.forEach((doc) => {
                    admins[admins.length] = doc.data();
                })
                return res.status(200).json(admins);
            })
            .catch(err => {
                return res.status(500).json(err);
            })
        }
        else {
            return res.status(401).json({ message: 'Not authorized to get Admins' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.getOwners = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            db.collection('/user-roles/roles/owners')
            .get()
            .then(data => {
                let owners = [];
                data.forEach((doc) => {
                    owners[owners.length] = doc.data();
                })
                return res.status(200).json(owners);
            })
            .catch(err => {
                return res.status(500).json(err);
            })
        }
        else {
            return res.status(401).json({ message: 'Not authorized to get Owners' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.completedTutorial = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    /* add code to test the values to make sure this accurate */ 
    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                let claims = user.customClaims;
                claims.completedTutorial = true;
                admin.auth().setCustomUserClaims(user.uid, claims)
                .then(() => {
                    return res.status(200).json({ message: 'Tutorial completed'});
                })
            });
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.removePermissions = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateUid(req.query);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then(decodedToken => {
        if (checkAdminPermission(decodedToken)) {
            admin.auth().getUser(req.query.uid)
            .then(user => {
                if (user.customClaims && user.customClaims.owner && user.customClaims.owner === true && decodedToken.admin && decodedToken.admin === true) {
                    return res.status(401).json({ message: 'Admins cannot remove Owners'});
                } else if (user.customClaims && user.customClaims.admin && user.customClaims.admin === true && decodedToken.admin && decodedToken.admin === true) {
                    return res.status(401).json({ message: 'Admins cannot remove admins'});
                } else {
                    Promise.all([
                        admin.auth().setCustomUserClaims(user.uid, {
                            assistant: false,
                            admin: false,
                            owner: false,
                            completedTutorial:  user.customClaims.completedTutorial,
                            banned: user.customClaims.banned,
                        }),
                        removeUserMetadata(user.uid),
                        db.doc(`/users/${ user.uid }`).update({ role: 'rater' }),
                        admin.auth().revokeRefreshTokens(user.uid)
                    ]) 
                    .then(() => {
                        return res.status(200).json({ message: `${ user.uid } no longer has permissions` })
                    })
                }
            })
            .catch(err => {
                console.log(err);
                return res.status(500).json(err);
            })  
        } else {
            return res.status(401).json({ message: 'Not authorized to remove permissions' }); 
        }         
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
};

exports.banUser = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateUid(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }
    /* add code to test the values to make sure this accurate */ 
    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)){
            admin.auth().getUser(req.body.uid)
            .then(userData => {
                if (!checkAssistantPermission(userData.customClaims)) {
                    userData.role = 'banned';
                    Promise.all([
                        db.doc(`/users/${ req.body.uid }`).update({ role: 'banned' }),
                        admin.auth().setCustomUserClaims(req.body.uid, {
                            assistant: false,
                            admin: false,
                            owner: false,
                            completedTutorial: userData.customClaims.completedTutorial,
                            banned: true,
                        }),
                        admin.auth().revokeRefreshTokens(req.body.uid)
                    ])
                    .then(() => {
                        return  res.status(200).json({ message: 'User successfully banned' }); 
                    })
                } else {
                    return res.status(401).json({ err: 'Can only ban raters' });
                }
            })
        } else {
            return res.status(401).json({ err: 'Cannot ban users' });
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.addTutorialRating = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateTutorialRating(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token, true)
    .then(decodedToken => {
        if (!decodedToken.email_verified) {
            return res.status(401).json({ err: 'Must verify email first' });
        }
        db.doc(`/tutorial-videos/${ req.body.title }`).get().then(doc => {
            if (!doc.exists) {
                res.status(404).json({ message: 'Video does not exist' });
            } else {
                videoData = doc.data();
                let floor = videoData.average - (videoData.stdev * tutorialAcceptableStdev);
                if (floor < 0) {
                    floor = 0;
                }
                const ceiling = videoData.average + (videoData.stdev * tutorialAcceptableStdev);
                if (req.body.average >= floor && req.body.average <= ceiling) {
                    addTutorialRatingPromise(decodedToken.uid, req.body.average, req.body.title, true).then(result => {
                        if (result.passed) {
                            res.status(200).json({ message: 'Tutorial completed', accepted: true, count: result.count, toPass: tutorialVideosToComplete });
                        } else {
                            res.status(200).json({ message: `Bubble rating was accepted!`,  accepted: true, count: result.count, toPass: tutorialVideosToComplete } )
                        }
                    })
                    .catch(err => {
                        console.log(err);
                        res.status(500).json({ err })
                    })
                } else {
                    db.doc(`/users/${ decodedToken.uid }`).get().then(doc => { //getting the accepted number
                        const userData = doc.data();
                        let count = 0;
                        userData.tutorialRatings.forEach(rating => {
                            if (rating.valid) {
                                count += 1;
                            }
                        })
                        res.status(200).json({ message: 'Bubble rating was not accepted', accepted: false, count, toPass: tutorialVideosToComplete });
                    });  
                }
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ err, message: 'Internal server error' })
        })
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
    });
}

exports.getUserScoreGraphData = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    /* add code to test the values to make sure this accurate */ 
    const promises = [];
    promises.push(db.doc(`/users/${ decodedToken.uid }`).get());
    promises.push(db.collection('users').orderBy('userScore', 'desc').limit(1).get())
    Promise.all(promises).then(data => {
        const user = data[0].data();
        let topUser = null;
        data[1].forEach(doc => {
            topUser = doc.data();
        })
        const accepted = user.accepted;
        return res.status(200).json({ top: topUser.userScore, user: user.userScore, accepted });
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err }); 
    });
}

exports.resetAllUserScores = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }
    /* add code to test the values to make sure this accurate */ 
    admin.auth().verifyIdToken(req.headers.token, true)
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            const promises = [];
            db.collection('users').get()
            .then(docs => {
                docs.forEach(doc => {
                    promises.push(doc.ref.update({ userScore: 0 }));
                })
            })
            Promise.all(promises).then(() => {
                return res.status(200).json({ message: 'Complete' });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to reset user scores' }); 
        }
    })  
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err }); 
    });
}

exports.updateUserCount  = (req, res) => {
    if (!req.headers.token) {
        return res.status(400).json({ message: 'Must have a token' }); 
    }

    admin.auth().verifyIdToken(req.headers.token) 
    .then((decodedToken) => {
        if (checkAdminPermission(decodedToken)) {
            db.collection('users').get()
            .then(data => {
                let count = 0;
                data.forEach(doc => {
                    count++;
                })
                db.doc(`/metadata/users`).update({ length: count }).then(() => {
                    return res.status(200).json({ message: 'Successfully updated' });
                })
            })
            .catch(err => {
                console.log(err);
                return res.status(500).json({ err: err });
            })
        } else {
            return res.status(401).json({ message: 'Not authorized to update users count' }); 
        }
    })
    .catch((err) => {
        console.log(err);
        return res.status(401).json({ err: err }); 
    });
}

const addTutorialRatingPromise = (uid, rating, video, valid) => {
    return new Promise((resolve, reject) => {
        db.doc(`/users/${ uid }`).get().then(doc => {
            const userData = doc.data();
            if (!userData.tutorialRatings) {
                userData.tutorialRatings = [];
            }
            if (userData.tutorialRatings.filter(r => r.title === video).length > 0 && userData.tutorialRatings.length < 10) {
                reject({ err: 'Tutorial video already reviewed' });
            }
            const promises = [];
            userData.tutorialRatings.push({ rating, video, valid });
            let count = 0;
            userData.tutorialRatings.forEach(rating => {
                if (rating.valid) {
                    count += 1;
                }
            })
            if (count >= tutorialVideosToComplete) {
                promises.push(
                    new Promise((resolve, reject) => {
                        admin.auth().getUser(uid)
                        .then((user) => {
                            let claims = user.customClaims;
                            claims.completedTutorial = true;
                            admin.auth().setCustomUserClaims(uid, claims).then(() => {
                                resolve();
                            })
                        })
                        .catch(err => {
                            reject(err);
                        })
                    })
                )
            }
            promises.push(doc.ref.set(userData));
            Promise.all(promises).then(() => {
                if (count >= tutorialVideosToComplete) {
                    console.log(count);
                    resolve({ passed: true, count })
                } else {
                    resolve({ passed: false, count });
                }
            });
        })
        .catch(err => {
            reject(err);
        }) 
    })
}

const removeAllUserRatings = (uid, all) => {
    return new Promise((resolve, reject) => {
        const videoDocs = [];
        const promises = [
            db.collection('incomplete-videos').where('raters', 'array-contains', uid).get()
            .then(docs => {
                docs.forEach(doc => {
                    videoDocs.push(doc)
                })
                return;
            }),
            db.collection('flagged-videos').where('raters', 'array-contains', uid).get()
            .then(docs => {
                docs.forEach(doc => {
                    videoDocs.push(doc)
                })
                return;
            }),
        ];
        if (all) {
            promises.push(
                db.collection('unusable-videos').where('raters', 'array-contains', uid).get()
                .then(docs => {
                    docs.forEach(doc => {
                        videoDocs.push(doc)
                    })
                    return;
                })
            );
            promises.push(
                db.collection('complete-videos').where('raters', 'array-contains', uid).get()
                .then(docs => {
                    docs.forEach(doc => {
                        videoDocs.push(doc)
                    })
                    return;
                }),
            );
        }
        Promise.all(promises)
        .then(() => {
            const promises = [];
            videoDocs.forEach(doc => {
                const docData = doc.data();
                const raters = [];
                const ratings = {};
                docData.raters.forEach(rater => {
                    if (rater !== uid) {
                        ratings[rater] = docData.ratings[rater];
                        raters.push(rater);
                    }
                })
                docData.raters = raters;
                docData.ratings = ratings;
                promises.push(doc.ref.set(docData));
            })
            Promise.all(promises).then(() => {
                resolve();
            })
        })
        .catch((err) => {
            reject(err);
        })
    })
}

const removeUserMetadata = (uid) => {
    return new Promise((resolve, reject) => {
        Promise.all([
            db.doc(`/user-roles/roles/admins/${ uid }`).delete(),
            db.doc(`/user-roles/roles/assistants/${ uid }`).delete(),
            db.doc(`/user-roles/roles/owners/${ uid }`).delete(),
        ])
        .then(() => {
            resolve();
        })
        .catch(err => {
            reject(err);
        })
    })
} 

const changeUserRole = (uid, role) => {
    return new Promise((resolve, reject) => {
        db.doc(`/users/${ uid }`).get().then(data => {
            let doc = data.data();
            if (!doc) {
                doc = {
                    userScore: 0, 
                    videosReviewed: 0, 
                    accepted: 0,
                    videosRated: [],
                    rejectedRatings: [],
                    ratingsRejected: 0,
                    role,
                    uid
                }
            } else {
                doc.role = role;
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

const changePermission = (user, role, grantedBy) => {
    return new Promise((resolve, reject) => {
        Promise.all([
            removeUserMetadata(user.uid), 
            changeUserRole(user.uid, role), 
            admin.auth().setCustomUserClaims(user.uid, {
                assistant: 'assistant' == role,
                admin: 'admin' == role,
                owner: 'owner' == role,
                completedTutorial: user.customClaims.completedTutorial,
                banned: user.customClaims.banned,
            }),
            admin.auth().revokeRefreshTokens(user.uid)
        ])
        .then(() => {
            db.doc(`/user-roles/roles/${ role }s/${ user.uid }`).set({
                email: user.email,
                role,
                uid: user.uid,
                granted: Date.now(),
                grantedBy,
            }).then(() => { resolve() });
        })
        .catch(err => {
            console.log(err);
            reject(err);
        })
    })
}
