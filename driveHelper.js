// driveHelper.js

const { google } = require('googleapis');
const fs = require('fs');

const credentials = {
  web: {
    client_id: process.env.CLIENT_ID,
    project_id: process.env.PROJECT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_secret: process.env.CLIENT_SECRET,
  },
};

const { client_secret, client_id, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

function uploadBackup(fileName) {
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  const fileMetadata = {
    name: fileName,
  };

  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream(fileName),
  };

  drive.files.create(
    {
      resource: fileMetadata,
      media: media,
      fields: 'id',
    },
    (err, file) => {
      if (err) {
        console.error('Dosya yüklenirken bir hata oluştu:', err);
      } else {
        console.log('Dosya başarıyla yüklendi. Dosya ID\'si:', file.data.id);
      }
    }
  );
}

module.exports = { uploadBackup };
