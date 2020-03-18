const { admin, db } = require('../util/admin');

const { validateSignupData, validateLoginData, validateUid, validateEmail } = require('../util/validators')

const config = require('../config');
const firebase = require('firebase');
firebase.initializeApp(config);

exports.signup = (req, res) => {
    const newUser = {
        email: req.body.email, 
        password: req.body.password,
    };

    const { valid, errors } = validateSignupData(newUser);
    
    if (!valid) {
        return res.status(400).json(errors);
    }

    firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
    .then((data) => {
        admin.auth().setCustomUserClaims(data.user.uid, {
            assistant: false,
            admin: false,
            owner: false,
            completedTutorial: false,
        })
        .then(() => {
            db.doc(`/users/all-users/user-data/${ user.uid }`).set({ 
                email: newUser.email,
                userScore: 0, 
                videosReviewed: 0, 
                accepted: 0, 
                outliers: 0, 
            })
            .then(() => {
                return res.status(201).json({ message: `${ req.body.email } is now signed up`})
            })
        })
    })
    .catch(err => {
        console.error(err);
        if(err.code === 'auth/email-already-in-use'){
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
        if(err.code === 'auth/wrong-password'){
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            admin.auth().getUser(req.query.uid)
            .then((user) => {
                if (!(decodedToken.owner && decodedToken.owner === true)) { // Owners can do anything
                    if (decodedToken.admin && decodedToken.admin === true && user.customClaims.admin && user.customClaims.admin === true) {
                        return res.status(406).json({ message: 'Admins cannot delete admins' }); 
                    } else if (decodedToken.admin && decodedToken.admin === true && user.customClaims.owner && user.customClaims.owner === true) {
                        return res.status(406).json({ message: 'Admins cannot delete owners' }); 
                    }
                } 
                removeUserMetadata(user.uid)
                .then(() => {
                    admin.auth().deleteUser(user.uid) 
                    .then(() => {
                        return res.status(200).json({ message: `${ user.email } has been deleted` });
                    })
                    .catch((err) => {
                        return res.status(500).json({ err: err }); 
                    });
                })
                .catch((err) => {
                    return res.status(500).json({ err: err }); 
                })
            })
            .catch((err) => {
                return res.status(500).json({ err: err }); 
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

exports.getUidFromEmail = (req, res) => {
    if (!req.headers.token) {
        return  res.status(400).json({ message: 'Must have a token' }); 
    }

    const { valid, errors } = validateEmail(req.body);

    if (!valid) {
        return res.status(400).json(errors);
    }

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            admin.auth().getUserByEmail(req.body.email)
            .then(user => {
                return res.json({ uid: user.uid })
            })
            .catch((err) => {
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                if (user.customClaims && user.customClaims.assistant == true) {
                    return res.status(200).json({ message: `${ user.email } is already an assistant`, user: user });
                }
                if (!(decodedToken.owner && decodedToken.owner === true)) { // Owners can do anything
                    if (decodedToken.admin && decodedToken.admin === true && user.customClaims.admin && user.customClaims.admin === true) {
                        return res.status(406).json({ message: 'Admins cannot set admins to assistants.' }); 
                    } else if (decodedToken.admin && decodedToken.admin === true && user.customClaims.owner && user.customClaims.owner === true) {
                        return res.status(406).json({ message: 'Admins cannot set admins to assistants.' }); 
                    }
                } 
                removeUserMetadata(user.uid)
                .then(() => {
                    admin.auth().setCustomUserClaims(user.uid, {
                        assistant: true,
                        admin: false,
                        owner: false,
                        completedTutorial: false,
                    })
                    .then(() => {
                        db.doc(`/users/roles/assistants/${ user.uid }`).set({
                            email: user.email,
                            role: 'Assistant',
                            uid: user.uid,
                            granted: Date.now(),
                            grantedBy: decodedToken.uid,
                        })
                        .then(() => {
                            return res.status(200).json({ message: `${ user.email } is now an assistant` })
                        })
                        .catch((err) => {
                            return res.status(500).json({ err: err }); 
                        });
                    })
                })
                .catch((err) => {
                    return res.status(500).json({ err: err }); 
                })
            })
            .catch((err) => {
                return res.status(500).json({ err: err }); 
            });
        }
        else {
            return res.status(401).json({ message: 'Not authorized to add assistant' }); 
        }
    })
    .catch((err) => {
        return res.status(401).json({ err }); 
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                if (user.customClaims && user.customClaims.admin && user.customClaims.admin === true) {
                    return res.status(200).json({ message: `${ user.email } is already an admin` });
                }
                removeUserMetadata(user.uid)
                .then(() => {
                    admin.auth().setCustomUserClaims(user.uid, {
                        assistant: false,
                        admin: true,
                        owner: false,
                        completedTutorial: user.customClaims.completedTutorial,
                    })
                    .then(() => {
                        db.doc(`/users/roles/admins/${ user.uid }`).set({
                            email: user.email,
                            role: 'Admin',
                            uid: user.uid,
                            granted: Date.now(),
                            grantedBy: decodedToken.uid,
                        })
                        .then(() => {
                            return res.status(200).json({ message: `${ user.email } is now an admin` })
                        })
                        .catch((err) => {
                            return res.status(500).json({ err: err }); 
                        });
                    })
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            admin.auth().getUser(req.body.uid)
            .then((user) => {
                if (user.customClaims && user.customClaims.owner && user.customClaims.owner === true) {
                    return res.status(200).json({ message: `${ user.email } is already an owner` });
                }
                removeUserMetadata(user.uid)
                .then(() => {
                    admin.auth().setCustomUserClaims(user.uid, {
                        assistant: false,
                        admin: false,
                        owner: true,
                        completedTutorial:  user.customClaims.completedTutorial
                    })
                    .then(() => {
                        db.doc(`/users/roles/owners/${ user.uid }`).set({
                            email: user.email,
                            role: 'Owner',
                            uid: user.uid,
                            granted: Date.now(),
                            grantedBy: decodedToken.uid,
                        })
                        .then(() => {
                            return res.status(200).json({ message: `${ user.email } is now an owner` })
                        })
                        .catch((err) => {
                            return res.status(500).json({ err: err }); 
                        });
                    })
                })
            }).catch((err) => {
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            db.collection('/users/roles/assistants')
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        console.log(decodedToken);
        if (decodedToken.owner && decodedToken.owner === true) {
            db.collection('/users/roles/admins')
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true) {
            db.collection('/users/roles/owners')
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
    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        admin.auth().getUserByEmail(req.body.email).then((user) => {
            let claims = user.customClaims;
            claims.completedTutorial = true;
            admin.auth().setCustomUserClaims(user.uid, claims)
        });
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

    admin.auth().verifyIdToken(req.headers.token)
    .then((decodedToken) => {
        if (decodedToken.owner && decodedToken.owner === true || decodedToken.admin && decodedToken.admin === true) {
            admin.auth().getUser(req.query.uid)
            .then(user => {
                if (user.customClaims && user.customClaims.owner && user.customClaims.owner === true && decodedToken.admin && decodedToken.admin === true) {
                    return res.status(200).json({ message: 'Admins cannot remove Owners'});
                } else if (user.customClaims && user.customClaims.admin && user.customClaims.admin === true && decodedToken.admin && decodedToken.admin === true) {
                    return res.status(200).json({ message: 'Admins cannot remove admins'});
                } else {
                    admin.auth().setCustomUserClaims(user.uid, {
                        assistant: false,
                        admin: false,
                        owner: false,
                        completedTutorial:  user.customClaims.completedTutorial
                    })
                    .then(() => {
                        removeUserMetadata(user.uid)
                        .then(() => {
                            return res.status(200).json({ message: `${ user.email } no longer has permissions` })
                        })
                    })
                }
            })
            .catch(err => {
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

exports.testToken = (req, res) => {
    if (!req.headers.token) {
        return  res.status(200).json({ err: 'Token is null' }); 
    } else {
        return  res.status(200).json({ err: 'Has a token' }); 
    }
};

const removeUserMetadata = (uid) => {
    return new Promise((resolve, reject) => {
        db.doc(`/users/roles/admins/${ uid }`).get().then(doc => {
            if (doc.exists) {
                doc.ref.delete();
            }
        })
        .then(() => {
            db.doc(`/users/roles/assistants/${ uid }`).get().then(doc => {
                if (doc.exists) {
                    doc.ref.delete();
                }
            })
        })
        .then(() => {
            db.doc(`/users/roles/owners/${ uid }`).get().then(doc => {
                if (doc.exists) {
                    doc.ref.delete();
                }
            })
        }).then(() => {
            resolve();
        })
        .catch(err => {
            reject(err);
        })
    })
} 


var promise1 = new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve('foo');
    }, 300);
  });
/*

const addOwner = (data, context) => {
    if (!context.auth.token.colaborator) {
        return {
            error: 'Must me an admin to add colaborators'
        }
    }
    const email = data.email; 
    return grantColaboratorRoles(email).then(() => {
        return {
            result: `Request fulfilled! ${ email } is now a collaborator`
        }
    });
}
*/
