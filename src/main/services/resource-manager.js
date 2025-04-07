import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import axios from 'axios';
import extract from 'extract-zip';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const BASE_PATH = path.join(app.getPath('userData'));
const RESOURCES_PATH = path.join(BASE_PATH, 'resources');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../config/resources.json');

let RESOURCES;
try {
    const config = await fs.readJson(CONFIG_PATH);
    RESOURCES = config.resources;
    
    for (const [name, resource] of Object.entries(RESOURCES)) {
        resource.downloadPath = path.join(RESOURCES_PATH, `${name}.zip`);
        resource.extractPath = path.join(RESOURCES_PATH, resource.path);
    }
} catch (error) {
    console.error('Erro ao carregar configuração de recursos:', error);
    throw new Error('Falha ao carregar configuração de recursos');
}

async function isValidZip(filePath) {
    try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
            return false;
        }
        return true;
    } catch (error) {
        console.error(`Erro ao verificar arquivo ZIP ${filePath}:`, error);
        return false;
    }
}

async function checkResource(resource) {
    try {
        if (!fs.existsSync(resource.extractPath)) {
            return false;
        }

        const files = await fs.readdir(resource.extractPath);
        return files.length > 0;
    } catch (error) {
        console.error(`Erro ao verificar recurso ${resource.extractPath}:`, error);
        return false;
    }
}

async function downloadResource(resource, progressCallback) {
    try {
        await fs.ensureDir(RESOURCES_PATH);

        if (fs.existsSync(resource.downloadPath)) {
            await fs.remove(resource.downloadPath);
        }

        const response = await axios({
            method: 'GET',
            url: resource.url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        const writer = createWriteStream(resource.downloadPath);
        
        response.data.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const progress = (downloadedSize / totalSize) * 100;
            progressCallback({
                resourceName: path.basename(resource.extractPath),
                progress: Math.round(progress)
            });
        });

        await pipeline(response.data, writer);

        const isValid = await isValidZip(resource.downloadPath);
        if (!isValid) {
            throw new Error(`Arquivo ZIP inválido: ${resource.downloadPath}`);
        }

        return true;
    } catch (error) {
        console.error(`Erro ao baixar recurso ${resource.url}:`, error);
        if (fs.existsSync(resource.downloadPath)) {
            await fs.remove(resource.downloadPath);
        }
        return false;
    }
}

async function extractResource(resource) {
    try {
        if (!fs.existsSync(resource.downloadPath)) {
            throw new Error(`Arquivo ZIP não encontrado: ${resource.downloadPath}`);
        }

        const isValid = await isValidZip(resource.downloadPath);
        if (!isValid) {
            throw new Error(`Arquivo ZIP inválido: ${resource.downloadPath}`);
        }

        if (fs.existsSync(resource.extractPath)) {
            await fs.remove(resource.extractPath);
        }

        await fs.ensureDir(resource.extractPath);
        await extract(resource.downloadPath, { dir: resource.extractPath });
        
        await fs.remove(resource.downloadPath);
        return true;
    } catch (error) {
        console.error(`Erro ao extrair recurso ${resource.downloadPath}:`, error);
        if (fs.existsSync(resource.downloadPath)) {
            await fs.remove(resource.downloadPath);
        }
        return false;
    }
}

export async function downloadResources(progressCallback) {
    try {
        await fs.ensureDir(BASE_PATH);

        for (const [name, resource] of Object.entries(RESOURCES)) {
            const exists = await checkResource(resource);
            
            if (!exists) {
                console.log(`Baixando ${name}...`);
                
                const downloadSuccess = await downloadResource(resource, progressCallback);
                if (!downloadSuccess) {
                    if (resource.required) {
                        throw new Error(`Falha ao baixar recurso obrigatório: ${name}`);
                    }
                    continue;
                }

                console.log(`Extraindo ${name}...`);
                const extractSuccess = await extractResource(resource);
                if (!extractSuccess) {
                    if (resource.required) {
                        throw new Error(`Falha ao extrair recurso obrigatório: ${name}`);
                    }
                    continue;
                }
            } else {
                console.log(`${name} já existe e está completo.`);
            }
        }

        return true;
    } catch (error) {
        console.error('Erro ao baixar recursos:', error);
        throw error;
    }
}

export async function checkResources() {
    try {
        for (const [name, resource] of Object.entries(RESOURCES)) {
            if (resource.required) {
                const exists = await checkResource(resource);
                if (!exists) {
                    return false;
                }
            }
        }
        return true;
    } catch (error) {
        console.error('Erro ao verificar recursos:', error);
        return false;
    }
} 