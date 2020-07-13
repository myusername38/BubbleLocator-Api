const { db } = require('../util/admin');
const { std, mean } = require('mathjs');
const FieldValue = require('firebase-admin').firestore.FieldValue;

exports.checkAgreement = (checkVideo) => {
    return new Promise((resolve, reject) => {
        const maxRatings = 5;
        const numOfDeviations = 3;
        const averages = [];
        const ratingMap = {};
        const specialCases = [];
        let flagged = false;
        let unusable = false;

        checkVideo.raters.forEach(rater => {
            const raterAverage = getRating(checkVideo.ratings[rater].rating)
            if (raterAverage < 0) {
                specialCases.push(raterAverage);
            } else {
                averages.push(raterAverage);
            }
            ratingMap[rater] = raterAverage;
        })

        let rejected = [];
        let accepted = [];
        if (averages.length >= 3) {
            const standardDev = std(averages, 'uncorrected');
            const mean1 = mean(averages);
            const upperRange = mean1 + (numOfDeviations * standardDev);
            let lowerRange = mean1 - (numOfDeviations * standardDev);
            if (lowerRange < 0) {
                lowerRange = 0;
            }
            checkVideo.raters.forEach(rater => {
                if (ratingMap[rater] < lowerRange || ratingMap[rater] > upperRange) {
                    rejected.push(rater);
                } else {
                    accepted.push(rater);
                }
            })
        } 
        /*
        if there are less than 3 accepted and there are special cases check agreement
        */
        if (accepted.length < 3 && specialCases.length >= 3) {
            accepted = [];
            rejected = [];
            let numBadQuality = 0;
            let numWashOut = 0;
            let numNoBubbles = 0;
            specialCases.forEach(rating => {
                if (rating === -1) {
                    numWashOut++;
                } else if (rating === -2) {
                    numNoBubbles++;
                } else {
                    numBadQuality++;
                }
            })

            let acceptedRating = 0;
            if (numWashOut >= 3) {
                acceptedRating = -1;
            } else if (numNoBubbles >= 3) {
                acceptedRating = -2;
            } else if (numBadQuality >= 3) {
                acceptedRating = -3;
            }

            if (acceptedRating === 0 && (numBadQuality + numWashOut) >= 3) {
                unusable = true;
                checkVideo.raters.forEach(rater => {
                    if (ratingMap[rater] === -3 || ratingMap[rater] === -1) {
                        accepted.push(rater);
                    } else {
                        rejected.push(rater);
                    }
                })
            } else if (acceptedRating !== 0) {
                checkVideo.raters.forEach(rater => {
                    if (ratingMap[rater] === acceptedRating) {
                        accepted.push(rater);
                    } else {
                        rejected.push(rater);
                    }
                })
            } 
        }
        // if not agree by now send off to be flagged 
        // need logic for that 
        if (accepted.length < 3 && checkVideo.raters.length >= maxRatings) {
            flagged = true;
        }

        if (accepted.length < 3 && !flagged) {
           return resolve();
        }

        const promises = [];

        let location = 'complete';
        if (flagged) {
            location = 'flagged';
        } else if (unusable) {
            location = 'unusable';
        }
       
        if (!flagged) {
            const acceptedDoc = checkVideo;
            acceptedDoc.raters = accepted;
            acceptedRatings = {};
            accepted.forEach(rater => {
                acceptedRatings[rater] = checkVideo.ratings[rater];
            })
            acceptedDoc.ratings = acceptedRatings;
            accepted.forEach((user) => {
                promises.push(db.doc(`/users/${ user }`).update({ userScore: FieldValue.increment(10), accepted:  FieldValue.increment(1) }));
            })
            rejected.forEach((user) => {
                promises.push(new Promise((resolve, reject) => {
                    db.doc(`/users/${ user }`).get().then(data => {
                        const doc = data;
                        doc.rejectedRatings.push({ rating: checkVideo.ratings[rater].rating, video: checkVideo.title });
                        doc.outliers += 1;
                        db.doc(`/users/${ user }`).set(doc)
                        .then(() => {
                            resolve();
                        })
                    })
                    .catch(err => {
                        reject(err);
                    }) 
                }));
            });
            promises.push(db.doc(`/${ location }-videos/${ checkVideo.title }`).set(acceptedDoc));
            promises.push(db.doc(`/flagged-videos/${ checkVideo.title }`).delete()); //don't want to delete and write at the same tiem 
        } else {
            promises.push(db.doc(`/${ location }-videos/${ checkVideo.title }`).set(checkVideo))
        }
        promises.push(db.doc(`/videos/${ checkVideo.title }`).update({ location: `${ location }-videos` }));
        promises.push(db.doc(`/incomplete-videos/${ checkVideo.title }`).delete());

       
        Promise.all(promises).then(() => {
            resolve();
        }) 
        .catch(err => {
            reject(err);
        })
    })
}

const getRating = (rating) => {
    if (rating.length === 1 && rating[0].frame === -1) {
        const bubble = rating[0];
        if (bubble.x === -1 && bubble.y === -1) {
            return -1;
        } else if (bubble.x === -2 && bubble.y === -2) {
            return -2;
        } else if (bubble.x === -3 && bubble.y === -3) {
            return -3;
        }
    }
    
    let emptyFrames = 0;
    const frames = [];
    rating.forEach(bubble => {
        if (!frames.includes(bubble.frame)) {
            frames.push(bubble.frame);
        }
        if (bubble.x === -2 && bubble.y === -2) {
            emptyFrames += 1;
        }
    });
    const average = (rating.length - emptyFrames) / frames.length;
    return average;
}
