const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'token.json';

const CLIENT_ID = '990085899784-qdrntiq1tdcpptr31f82a2bd8lm8oer8.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

function authorize(callback, filePath) {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback, filePath);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, filePath);
  });
}

function getNewToken(oAuth2Client, callback, filePath) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client, filePath);
    });
  });
}

function uploadBackup(auth, filePath) {
  const drive = google.drive({ version: 'v3', auth });
  const fileMetadata = {
    name: filePath.split('/').pop(),
  };
  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream(filePath),
  };
  drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  }, (err, file) => {
    if (err) {
      console.error(err);
    } else {
      console.log('File Id: ', file.data.id);
    }
  });
}

function backup(filePath) {
  authorize(uploadBackup, filePath);
}

module.exports = { backup };
