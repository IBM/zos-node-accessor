/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2021 IBM Corp.                                             */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

import { Entry } from './Entry';

/**
 * LOADLIB Dataset member entry
 */

 export interface LoadLibMemberEntry extends Entry {
    /**
     * Size
     */
    size?: number;

    /**
     * Track/Record location
     */
    ttr?: string;

    /**
     * Alias
     */
    aliasOf?: string;

    /**
     * Authorization code
     */
    ac?: number;

    /**
     * Attributes
     */
    attributes?: string;

    /**
     * Addressing mode
     */
    amode?: string;

    /**
     * Resident mode
     */
    rmode?: string;
}
