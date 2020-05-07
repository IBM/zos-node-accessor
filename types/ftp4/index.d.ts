
declare module 'ftp4';
declare module 'ftp4/lib/parser';

interface FTP {
    ascii(arg0: (err: Error) => void): void;
    binary(callback: (err: Error) => void): void;
    connect(options: FTPConnectionOption): void;
    delete(path: string, arg1: (err: Error) => void): void;
    destroy(): void;
    end(): void;
    get(path: string, arg1: (err: Error, readStream: import("fs").ReadStream) => void): void;
    site(siteCommands: string, arg1: (err: Error) => void): void;
    list(path: string, arg1: (err: FtpError, list: string[]) => void): void;
    logout(callback: (err: Error) => void): void;
    mkdir(path: string, arg1: (err: Error) => void): void;
    on(arg0: string, arg1: () => void): import('net').Socket;
    put(input: string | Buffer | NodeJS.ReadableStream, destPath: string, arg2: (err: Error, text: string) => void): void;
    rename(oldPath: string, newPath: string, arg2: (err: Error) => void): void;
}

interface FTPConnectionOption {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
    secureOptions?: object;
    connTimeout: number;
    pasvTimeout: number;
    keepalive: number;
}

interface FtpError extends Error {
    code: number;
}
