const functions = require('firebase-functions');

const { admin, db } = require('./util/admin');
const cors = require('cors');

const { signup, login, grantOwner, grantAdmin, grantAssistant, completedTutorial, getAssistants, getAdmins, getOwners, removePermissions, testToken, getUidFromEmail, deleteUser } = require('./handlers/users');
const { addVideo, getVideoData, getReviewVideo, addTutorialVideo, getExpandedVideoData, getTutorialVideos } = require('./handlers/bubbles');

const express = require('express');
const app = express();

app.use(cors());

app.post('/login', login);
app.post('/signup', signup);
app.post('/grant-owner', grantOwner);
app.post('/grant-admin', grantAdmin);
app.post('/grant-assistant', grantAssistant);
app.post('/add-video', addVideo);
app.post('/get-uid', getUidFromEmail);
app.delete('/delete-user', deleteUser);
app.get('/get-video-data', getVideoData);
app.get('/get-assistants', getAssistants);
app.get('/get-admins', getAdmins);
app.get('/get-owners', getOwners);
app.delete('/remove-permissions', removePermissions);
app.get('/token-refresh', testToken);
app.get('/get-review-video', getReviewVideo);
app.post('/add-tutorial-video', addTutorialVideo);
app.get('/get-tutorial-videos', getTutorialVideos);
app.get('/get-expanded-video-data', getExpandedVideoData);


exports.countDocumentsChange = functions.firestore.document('/incomplete-videos/{title}').onWrite((change, context) => {

    const categoryId = context.params.categoryId;
    const categoryRef = db.collection('metadata').doc('incomplete-videos')

    let FieldValue = require('firebase-admin').firestore.FieldValue;

    if (!change.before.exists) {
        // new document created : add one to count
        categoryRef.update({length: FieldValue.increment(1)});
        console.log("%s numberOfDocs incremented by 1", categoryId);

    } else if (change.before.exists && change.after.exists) {

        // updating existing document : Do nothing

    } else if (!change.after.exists) {

        // deleting document : subtract one from count
        categoryRef.update({length: FieldValue.increment(-1)});
        console.log("%s numberOfDocs decremented by 1", categoryId);

    }

    return 0;
});

const verfiyToken = (token) => {
    admin.auth().verifyIdToken(token)
    .then((decodedToken) => {
        return decodedToken;
    }).catch((error) => {
        return error;
    });
}

exports.api = functions.https.onRequest(app);
