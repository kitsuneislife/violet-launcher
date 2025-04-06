
const { app } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function loginEly(username, password) {
  try {
    const response = await axios.post('https://authserver.ely.by/auth/authenticate', {
      username,
      password,
      requestUser: true
    });

    const data = response.data;
    const profilePath = path.join(app.getPath('userData'), 'profile.json');

    let profileData = {};
    if (fs.existsSync(profilePath)) {
      try {
        const fileContent = fs.readFileSync(profilePath, 'utf-8');
        profileData = JSON.parse(fileContent);
      } catch (err) {
        console.warn('profile.json inválido. Recriando...');
      }
    }

    profileData.authorization = data;

    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf-8');
    console.log('Credenciais da Ely salvas em profile.json');

    return data;
  } catch (error) {
    throw new Error('Falha ao autenticar:' + (error.response?.data?.errorMessage || error.message));
  }
}

module.exports = { loginEly };
