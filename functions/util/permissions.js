
exports.checkAssistantPermission = (decodedToken) => {
    return (decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true) ||
           (decodedToken.assistant && decodedToken.assistant === true);
}

exports.checkAdminPermission = (decodedToken) => {
    return (decodedToken.owner && decodedToken.owner === true) || (decodedToken.admin && decodedToken.admin === true);
}

exports.checkOwnerPermission = (decodedToken) => {
    return (decodedToken.owner && decodedToken.owner === true);
}

exports.checkCompletedTutorial = (decodedToken) => {
    return decodedToken.completedTutorial && decodedToken.completedTutorial === true;
}

exports.checkBannedUser = (decodedToken) => {
    return decodedToken.banned && decodedToken.banned === true;
}
