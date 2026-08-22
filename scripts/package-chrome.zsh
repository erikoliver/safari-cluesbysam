#!/bin/zsh

set -euo pipefail

script_directory="${0:A:h}"
repository_root="${script_directory:h}"
cd "$repository_root"

extension_version="$(node -p "require('./ChromeExtension/manifest.json').version")"
package_name="CluesKeyboard-Chrome-${extension_version}"
distribution_directory="${repository_root}/dist"
unpacked_path="${distribution_directory}/${package_name}"
archive_path="${distribution_directory}/${package_name}.zip"
temporary_archive="${archive_path}.tmp"

mkdir -p "$distribution_directory"
rm -rf "$unpacked_path"
rm -f "$temporary_archive"
trap 'rm -f "$temporary_archive"' EXIT
cp -RL ChromeExtension "$unpacked_path"
(
  cd "$distribution_directory"
  /usr/bin/zip -q -r -X "$temporary_archive" "$package_name"
)
mv "$temporary_archive" "$archive_path"

echo "$unpacked_path"
echo "$archive_path"
