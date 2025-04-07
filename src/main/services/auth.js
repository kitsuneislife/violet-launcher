import axios from 'axios';
import crypto from 'crypto';

const ELY_API_URL = 'https://authserver.ely.by/auth';

export const loginEly = async (username, password) => {
  try {
    const clientToken = crypto.randomBytes(16).toString('hex');
    
    const response = await axios.post(`${ELY_API_URL}/authenticate`, {
      username,
      password,
      clientToken,
      agent: {
        name: 'Minecraft',
        version: 1
      }
    });

    return {
      accessToken: response.data.accessToken,
      clientToken: response.data.clientToken,
      user: {
        id: response.data.selectedProfile.id,
        username: response.data.selectedProfile.name
      }
    };
  } catch (error) {
    if (error.response) {
      switch (error.response.status) {
        case 403:
          throw new Error('Usuário ou senha incorretos');
        case 429:
          throw new Error('Muitas tentativas de login. Tente novamente mais tarde');
        default:
          throw new Error('Erro ao fazer login. Tente novamente mais tarde');
      }
    }
    throw new Error('Erro de conexão. Verifique sua internet');
  }
};

export const validateToken = async (accessToken, clientToken) => {
  try {
    await axios.post(`${ELY_API_URL}/validate`, {
      accessToken,
      clientToken
    });
    return true;
  } catch {
    return false;
  }
};

export const refreshToken = async (accessToken, clientToken) => {
  try {
    const response = await axios.post(`${ELY_API_URL}/refresh`, {
      accessToken,
      clientToken
    });
    return response.data;
  } catch (error) {
    throw new Error('Erro ao atualizar o token de acesso');
  }
}; 