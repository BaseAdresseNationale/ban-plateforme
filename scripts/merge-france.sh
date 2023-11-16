#!/bin/bash
zcat adresses-01.csv.gz | head -n 1 | gzip > adresses-france.csv.gz.tmp
for filename in $(ls adresses-*.csv.gz); do zcat $filename | sed 1d | gzip >> adresses-france.csv.gz.tmp; done
mv adresses-france.csv.gz.tmp adresses-france.csv.gz

zcat lieux-dits-01-beta.csv.gz | head -n 1 | gzip > lieux-dits-beta-france.csv.gz.tmp
for filename in $(ls lieux-dits-*.csv.gz); do zcat $filename | sed 1d | gzip >> lieux-dits-beta-france.csv.gz.tmp; done
mv lieux-dits-beta-france.csv.gz.tmp lieux-dits-beta-france.csv.gz