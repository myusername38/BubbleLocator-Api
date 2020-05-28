const functions = require('firebase-functions');
const { std } = require('mathjs')

const { admin, db } = require('./util/admin');
const cors = require('cors');

const { signup, login, grantOwner, grantAdmin, grantAssistant, completedTutorial, getAssistants, getAdmins, getOwners, removePermissions, testToken, getUidFromEmail, deleteUser, banUser, addTutorialRating, getUserScoreGraphData } = require('./handlers/users');
const { addVideo, getVideoRatings, getReviewVideo, addTutorialVideo, getExpandedVideoData, getTutorialVideos, submitVideoRating, setVideo, getAllCompleteVideos, resetVideo, deleteVideo, deleteVideoRating, getVideo, getTutorialVideo } = require('./handlers/bubbles');
const { checkAgreement } = require('./handlers/videos');

const express = require('express');
const app = express();

let whitelist = ['http://localhost:4200', 'https://vastdime.com']
let corsOptions = {
    origin: (origin, callback) => {
        callback(null, true)
        /*
        if (whitelist.includes(origin)) {

            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
        */
    }
}

app.use(cors(corsOptions));

app.post('/login', login);
app.post('/signup', signup);
app.post('/grant-owner', grantOwner);
app.post('/grant-admin', grantAdmin);
app.post('/grant-assistant', grantAssistant);
app.post('/add-video', addVideo);
app.post('/add-tutorial-rating', addTutorialRating);
app.get('/get-uid-from-email', getUidFromEmail);
app.post('/completed-tutorial', completedTutorial);
app.post('/reset-video', resetVideo);
app.delete('/delete-video', deleteVideo);
app.delete('/delete-video-rating', deleteVideoRating);
app.delete('/delete-user', deleteUser)
app.put('/ban-user', banUser);
app.post('/get-video-ratings', getVideoRatings);
app.get('/get-tutorial-video', getTutorialVideo);
app.get('/get-all-completed-videos', getAllCompleteVideos);
app.get('/get-assistants', getAssistants);
app.get('/get-admins', getAdmins);
app.get('/get-owners', getOwners);
app.get('/get-video', getVideo);
app.get('/get-user-score-graph-data', getUserScoreGraphData);
app.delete('/remove-permissions', removePermissions);
app.get('/get-review-video', getReviewVideo);
app.post('/add-tutorial-video', addTutorialVideo);
app.get('/get-tutorial-videos', getTutorialVideos);
app.get('/get-expanded-video-data', getExpandedVideoData);
app.post('/submit-video-rating', submitVideoRating);

const numOfDeviations = 3;

exports.countIncompleteVideos = functions.firestore.document('/incomplete-videos/{title}').onWrite((change, context) => {
    const categoryRef = db.collection('metadata').doc('incomplete-videos');
    let FieldValue = require('firebase-admin').firestore.FieldValue;
    if (!change.before.exists) {
        categoryRef.update({ length: FieldValue.increment(1) });
    } else if (change.before.exists && change.after.exists) {
        const doc = change.after.data();
        if (doc.raters[0] && doc.raters.length >= 3) {
            checkAgreement(doc).then(() => {
                return;
            })
            .catch(err => {
                console.log(err);
            })
        }
    } else if (!change.after.exists) {
        categoryRef.update({ length: FieldValue.increment(-1) });
    }
    return 0;
});

exports.countCompleteVideos = functions.firestore.document('/complete-videos/{title}').onWrite((change, context) => {
    const categoryRef = db.collection('metadata').doc('complete-videos');
    let FieldValue = require('firebase-admin').firestore.FieldValue;
    if (!change.before.exists) {
        console.log('up one');
        categoryRef.update({ length: FieldValue.increment(1) });
    } else if (change.before.exists && change.after.exists) {
        return;
    } else if (!change.after.exists) {
        console.log('downOne');
        categoryRef.update({ length: FieldValue.increment(-1) });
    }
    return 0;
});

exports.countTutorialVideos = functions.firestore.document('/tutorial-videos/{title}').onWrite((change, context) => {
    const categoryRef = db.collection('metadata').doc('tutorial-videos');
    let FieldValue = require('firebase-admin').firestore.FieldValue;
    if (!change.before.exists) {
        categoryRef.update({ length: FieldValue.increment(1) });
    } else if (change.before.exists && change.after.exists) {
        return;
    } else if (!change.after.exists) {
        categoryRef.update({ length: FieldValue.increment(-1) });
    }
    return 0;
});

exports.countFlaggedVideos = functions.firestore.document('/flagged-videos/{title}').onWrite((change, context) => {
    const categoryRef = db.collection('metadata').doc('flagged-videos');
    let FieldValue = require('firebase-admin').firestore.FieldValue;
    if (!change.before.exists) {
        categoryRef.update({ length: FieldValue.increment(1) });
    } else if (change.before.exists && change.after.exists) {
        return;
    } else if (!change.after.exists) {
        categoryRef.update({ length: FieldValue.increment(-1) });
    }
    return 0;
});

exports.countUnusableVideos = functions.firestore.document('/unusable-videos/{title}').onWrite((change, context) => {
    const categoryRef = db.collection('metadata').doc('/unusable-videos');
    let FieldValue = require('firebase-admin').firestore.FieldValue;
    if (!change.before.exists) {
        categoryRef.update({ length: FieldValue.increment(1) });
    } else if (change.before.exists && change.after.exists) {
        return;
    } else if (!change.after.exists) {
        categoryRef.update({ length: FieldValue.increment(-1) });
    }
    return 0;
});

exports.countUsers = functions.firestore.document('/users/{title}').onWrite((change, context) => {
    const categoryRef = db.collection('metadata').doc('users');
    let FieldValue = require('firebase-admin').firestore.FieldValue;
    if (!change.before.exists) {
        categoryRef.update({ length: FieldValue.increment(1) });
    } else if (change.before.exists && change.after.exists) {
        return;
    } else if (!change.after.exists) {
        categoryRef.update({ length: FieldValue.increment(-1) });
    }
    return 0;
});

exports.api = functions.https.onRequest(app);
