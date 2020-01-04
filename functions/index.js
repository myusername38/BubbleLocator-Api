const functions = require('firebase-functions');

const cors = require('cors');

const { signup, login, grantOwner, grantAdmin, grantAssistant, completedTutorial, getAssistants, getAdmins, getOwners, removePermissions, testToken, getUidFromEmail, deleteUser } = require('./handlers/users');
const { addVideo, getVideoData } = require('./handlers/bubbles');

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

const verfiyToken = (token) => {
    admin.auth().verifyIdToken(token)
    .then((decodedToken) => {
        return decodedToken;
    }).catch((error) => {
        return error;
    });
}

exports.api = functions.https.onRequest(app);
