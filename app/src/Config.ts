require('dotenv').config();

export interface AppConfig {
    host: string;
    port: number;
    bchdUrl: string;
    basepath: string;
}

const Config: AppConfig = {
    host: process.env.HOST ?? 'localhost',
    port: Number.parseInt(process.env.PORT ?? '3000'),
    bchdUrl: process.env.BCHD_URL ?? 'bchd.fountainhead.cash:443',
    basepath: process.env.BASE_PATH ?? '/',
};

export { Config };
