const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx)) return true;
    else return false;
}
 
const isEmpty = (s) => {
    if (s.trim() === '') return true;
    else return false;
}

exports.validateSignupData = (data) => {
    let errors = {};

    if (isEmpty(data.email)) {
        errors.email = 'Email must not be empty'
    } else if (!isEmail(data.email)){
        errors.email = 'Must be a valid email address'
    } else if (isEmpty(data.password)) {
        errors.password = 'Password must not be empty'
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateLoginData = (data) => {
    let errors = {};

    if (isEmpty(data.email)) {
        errors.email = 'Email must not be empty'
    } else if (!isEmail(data.email)){
        errors.email = 'Must be a valid email address'
    } else if (isEmpty(data.password)) {
        errors.password = 'Password must not be empty'
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateUid = (uid) => {
    let errors = {};

    if (isEmpty(uid.toString())) {
        errors.uid = 'Uid must not be empty'
    } 
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateEmail = (data) => {
    let errors = {};

    const email = data.email;

    if (isEmpty(email)) {
        errors.email = 'Email cannot be empty';
    } else if (!isEmail(email)) {
        errors.email = 'Must be a valid email address';
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.getRole = (data) => {
    if (data.assistant) {
        return 'Assistant'
    } else if (data.admin) {
        
    }
}

exports.validateUserToken = (decodedToken) => {
    let errors = {};

    if (!(decodedToken.completedTutorial && decodedToken.completedTutorial === true)) {
        errors.email = 'Must verify email'
    }

    if (!(decodedToken.completedTutorial && decodedToken.completedTutorial === true)) {
        errors.tutorial = 'Must complete tutorial before getting served videos'
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateVideo = (data) => {
    let errors = {};
    console.log(data.url);
    if (isEmpty(data.url)){
        errors.url = 'Must be a valid email address'
    } else if (data.url.substring(0, 26) !== 'https://www.dropbox.com/s/') {
        errors.url = 'Videos must be from dropbox'
    } else if (data.url.substring(data.url.length - 4, data.url.length) !== 'dl=0') {
        errors.url = 'Video url must end with dl=0' 
    } else if (data.fps < 0) {
        errors.fps = 'FPS cannot be negative'
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateRatingData

/*
title: id,
added: Date.now(),
user: decodedToken.email,
status: 'tutorial',
average: req.body.average, 
url

*/

exports.validateGetExpandedVideoData = (data) => {
    errors = {};

    if (isEmpty(data.title)) {
        errors.title = 'Must have a title'
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateTutorialVideo = (data) => {
    let errors = {};
   
    const videoValid = this.validateVideo(data)
    if (!videoValid.valid) {
        return videoValid;
    } else if (!data.rangeFloor) {
        errors.rangeFloor = 'Must have a floor for the range'
    } else if (data.rangeFloor < 0) {
        errors.rangeFloor = 'Floor must not be negative'
    } else if (!data.rangeCeiling) {
        errors.rangeCeiling = 'Must have a range ceiling'
    } else if (data.rangeCeiling < 0 ) {    
        errors.rangeCeiling = 'Ceiling must not be negative'
    } else if (data.rangeFloor > data.rangeCeiling) {
        errors.rangeCeiling = 'Ceiling must be higher than the floor'
    } 
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
} 

exports.validateDeleteRating = (data) => {
    let errors = {};
    
    if (!data.uid) {
        errors.uid = 'Must have uid'
    } else if (isEmpty(data.uid)) {
        errors.uid = 'Uid must not be empty'
    } else if (data.location) {
        if (!(data.location === 'incomplete' || data.location === 'complete' )) {
            errors.location = 'Location must be incomplete or complete'
        }
    } else if (!data.title) {
        errors.title = 'Must have a title';
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.validateVideoTitle = (data) => {
    let errors = {};
    
    if (!data.title) {
        errors.title = 'Must have a title';
    } else if (isEmpty(data.title)) {
        errors.title = 'Title must not be emtpy';
    } else if (data.title.substring(data.title.length - 4, data.title.length) !== '.mp4') {
        errors.title = 'Title must end in mp4';
    }
    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}