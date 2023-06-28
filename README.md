# analyzer-earmo

## Earmo env

Declare env variable DELIVER_RESULTS_ENDPOINT with the endpoint which collects the results.
e.g.

```
DELIVER_RESULTS_ENDPOINT=http://51.210.255.156:3000/api/result
```

Declare env variable EARMO_HOME with the forder of Earmo.
e.g.

```
EARMO_HOME=/data/greenstamp/analyzer-earmo-api
UPLOADS_HOME=/data/greenstamp/analyzer-earmo-api/uploads
```


## Jadx software

``` https://github.com/skylot/jadx ```

``` jadx ApkPath -d OutputFolder -j 8 ```


## Earmo software

``` https://github.com/moar82/EARMO/wiki ```

``` java -jar RefactoringStandarStudyAndroid.jar conf.prop ```

