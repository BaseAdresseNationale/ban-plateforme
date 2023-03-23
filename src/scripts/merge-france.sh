#!/bin/bash
zcat adresses-01.csv.gz | head -n 1 | gzip > adresses-france.csv.gz.tmp
for filename in $(ls adresses-*.csv.gz); do zcat $filename | sed 1d | gzip >> adresses-france.csv.gz.tmp; done
mv adresses-france.csv.gz.tmp adresses-france.csv.gz
