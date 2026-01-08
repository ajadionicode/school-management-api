module.exports = {
    'username': (data)=>{
        if(data.trim().length < 3){
            return false;
        }
        return true;
    },
    'mongoId': (data) => {
        return /^[a-fA-F0-9]{24}$/.test(data);
    },
    'dateString': (data) => {
        const date = new Date(data);
        return !isNaN(date.getTime());
    },
    'phoneNumber': (data) => {
        return /^\+?[1-9]\d{1,14}$/.test(data);
    },
}