#!/bin/sh

LOGDIR=.
LOGFILE=$LOGDIR/rssget.log

mkdir -p $LOGDIR
echo `date` starting rssget >> $LOGFILE
nohup node rssget.js | tee -a $LOGFILE > /dev/null &
