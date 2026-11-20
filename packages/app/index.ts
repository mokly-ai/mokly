/**
 * The application entry. An authentication landing's provider input leaves the
 * address before Expo Router loads, because the router records the address it
 * starts on and writes that record back once it has mounted. Imports evaluate
 * in order, so the capture runs first.
 */
import "./src/navigation/callback-input";
import "expo-router/entry";
