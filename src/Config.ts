require('dotenv').config();

export interface AppConfig {
    host: string;
    port: number;
    bchdUrl: string;
}

const Config: AppConfig = {
    host: process.env.HOST ?? 'localhost',
    port: Number.parseInt(process.env.PORT ?? '3000'),
    bchdUrl: process.env.BCHD_URL ?? 'bchd.fountainhead.cash:443',
};

export { Config };
