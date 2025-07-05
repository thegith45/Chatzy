const mongoose =require('mongoose');

const UserSchema = new mongoose.Schema({
    username : {type: String, unique: true},
    password: String,
}, {timestamps: true});

const USerModel = mongoose.model('User', UserSchema);
module.exports = USerModel;