//*******************************************************************
//*                                                                    
//* Copyright (c) 2017 IBM Corp.                                     
//* All rights reserved. This program and the accompanying materials 
//* are made available under the terms of the Eclipse Public License 
//* v1.0 which accompanies this distribution, and is available at   
//* http://www.eclipse.org/legal/epl-v10.html                       
//*                                                                 
//* Contributors:                                                   
//*  IBM Corp. - initial API and implementation                     
//*                                                                 
//*******************************************************************
//UNTERSE  JOB  MSGLEVEL=(1,1),NOTIFY=&SYSUID,MSGCLASS=__MSGCLASS__,
//UNTERSE  EXEC PGM=TRSMAIN,PARM=UNPACK                                 
//SYSPRINT DD   SYSOUT=*                                               
//INFILE   DD DSN=__INPUT__,                          
//             DISP=SHR                                                 
//OUTFILE  DD DSN=__OUTPUT__,                                 
//             SPACE=(CYL,(5,1),RLSE),DISP=(NEW,CATLG,DELETE)           
//                                                                      
