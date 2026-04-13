# Property Data Output Rules

1. Each property must have its own folder under `data/properties/`.
2. The folder name must be derived from the property address and stay stable across reruns.
3. Each property folder may contain exactly one structured output file: `property-data.csv`.
4. The CSV schema is fixed to `source,field,value`.
5. Data source separation happens in the `source` column, not by creating separate spreadsheets.
6. `source` must identify the origin of each row, such as `property`, `geowarehouse`, `realm`, or `generated`.
7. A property run is considered failed if any required `realm` or `geowarehouse` field is blank in the CSV.
8. Legacy spreadsheets for a property must not be recreated once the property-folder CSV format is in use.
