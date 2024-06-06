const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'token.json';

function authorize(credentials, callback, filePath) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

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
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), uploadBackup, filePath);
  });
}

module.exports = { backup };
