const functions = require('firebase-functions');
const cors = require('cors');

const { signup, login, grantOwner, grantAdmin, grantAssistant, completedTutorial, getAssistants, getAdmins, getOwners, removePermissions, testToken, getUidFromEmail, deleteUser, banUser, addTutorialRating, getUserScoreGraphData, removeUserAccount, resetAllUserScores, updateUserCount } = require('./handlers/users');
const { addVideo, getVideoRatings, getReviewVideo, addTutorialVideo, getExpandedVideoData, getTutorialVideos, setVideo, getAllCompleteVideos, resetVideo, deleteVideo, deleteVideoRating, getVideo, getTutorialVideo } = require('./handlers/bubbles');
const { updateCount, checkAgreement, reviewFlaggedVideo, submitVideoRating } = require('./handlers/videos');

const express = require('express');
const app = express();

let whitelist = ['https://decobubbles.com', 'https://www.decobubbles.com',];
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
app.post('/skip-tutorial', completedTutorial);
app.post('/reset-video', resetVideo);
app.delete('/delete-video', deleteVideo);
app.delete('/delete-video-rating', deleteVideoRating);
app.delete('/delete-user', deleteUser);
app.delete('/remove-user-account', removeUserAccount);
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
app.post('/review-flagged-video', reviewFlaggedVideo);
app.post('/reset-user-scores', resetAllUserScores);
app.post('/update-count', updateCount);
app.post('/update-user-count', updateUserCount);

const numOfDeviations = 3;

exports.api = functions.https.onRequest(app);
