{{flutter_js}}
{{flutter_build_config}}

// Version the compiled entrypoint so a previously cached bundle cannot mask a deploy.
const webBuildVersion = '20260927i';
for (const build of _flutter.buildConfig.builds) {
  if (build.mainJsPath) {
    build.mainJsPath += `?v=${webBuildVersion}`;
  }
}

_flutter.loader.load();
