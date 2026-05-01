Legacy local zip scratch space.

The packer wrappers now read work-dir/lumiscript-root.conf and use the configured
LumiScript storage exports directory:

- storage/exports/trigger.lumiscript.zip for unpacking
- storage/exports/to-be-imported.lumiscript.zip for packing
**must match that exact name!**
