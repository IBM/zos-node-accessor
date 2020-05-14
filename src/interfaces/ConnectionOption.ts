/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017, 2020 IBM Corp.                                       */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

/**
 * Options of FTP connection
 */
export interface ConnectionOption {
    /**
     * The hostname or IP address of the z/OS server to connect to.
     */
    host: string;

    /**
     * The port of the z/OS FTP server. The default is 21.
     */
    port?: number;

    /**
     * Username for authentication on z/OS.
     */
    user: string;

    /**
     * Password for authentication on z/OS.
     */
    password: string;

    /**
     * Set to true for both control and data connection encryption. The default is false.
     */
    secure?: boolean;

    /**
     * Additional options to be passed to `tls.connect()`.
     */
    secureOptions?: object;

    /**
     * How long (in milliseconds) to wait for the control connection to be established. The default is 30000.
     */
    connTimeout?: number;

    /**
     * How long (in milliseconds) to wait for a PASV data connection to be established. The default is 30000.
     */
    pasvTimeout?: number;

    /**
     * How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. The default is 10000.
     */
    keepalive?: number;
}
