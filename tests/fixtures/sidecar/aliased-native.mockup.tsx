import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { defineScreen } from "@mokly/mokly";

const styles = StyleSheet.create({
  box: { backgroundColor: "rgb(4, 5, 6)", padding: 12 },
});

export default defineScreen({
  title: "Aliased native styles",
  description: "",
  relatedDocs: [],
  props: {},
  render: () => (
    <View style={styles.box}>
      <Text>Aliased native</Text>
    </View>
  ),
});
