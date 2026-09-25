// react-native-web ships no type declarations; the example render adapter
// only uses its AppRegistry for server-side style collection.
declare module "react-native-web";

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.css";
