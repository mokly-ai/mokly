import { ClassNames } from "@emotion/react";
import { StyleSheet, View } from "react-native-web";
import { styled } from "styled-components";

import { defineScreen } from "@mokly/mokly";

const Button = styled.button`
  color: rgb(1, 2, 3);
`;
const styles = StyleSheet.create({ box: { backgroundColor: "rgb(4, 5, 6)" } });
export default defineScreen({
  title: "Runtime styles",
  description: "Known consumer registries.",
  relatedDocs: [],
  render: () => (
    <View style={styles.box}>
      <Button>Styled</Button>
      <ClassNames>
        {({ css }) => <p className={css({ color: "rgb(7, 8, 9)" })}>Emotion</p>}
      </ClassNames>
    </View>
  ),
});
