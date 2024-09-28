TV4-CLI
=======

Command-line interface for [tv4](https://github.com/geraintluff/tv4), a JSON-Schema v4 validator.

The easiest way to run this is using `npx`.

```bash
npx tv4-cli --help

npx tv4-cli --schema=schema.json data.json

# Files and schemas can be local files or URLs.
npx tv4-cli --schema=http://example.com/schema.json http://example.net/data.json

# YAML is supported, and multiple data files can be checked at once.
npx tv4-cli --schema=schema.yaml records/*.yaml

# Can fail validation if extra properties are found that are not described in
# the schema.
npx tv4-cli --ban --schema=schema.yaml data.json

# Debugging information can be shown
DEBUG=tv4-cli npx tv4-cli --schema=schema.json data-file.json

# Return codes indicate types of failures
if ! npx tv4-cli --schema=schema.json data.json; then
    echo "Validation failed!"
fi
```
