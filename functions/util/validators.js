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
