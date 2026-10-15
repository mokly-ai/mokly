import { StyleSheet, View } from "react-native-web";

import { defineScreen } from "@mokly/mokly";
const styles = StyleSheet.create({
  first: { backgroundColor: "rgb(11,22,33)" },
  second: { backgroundColor: "rgb(44,55,66)" },
});
export default defineScreen({
  title: "Registry",
  description: "",
  relatedDocs: [],
  props: { useSecond: false },
  render: (props) => (
    <View style={props.useSecond ? styles.second : styles.first}>Registry</View>
  ),
});
