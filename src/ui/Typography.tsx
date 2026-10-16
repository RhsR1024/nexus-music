import {createContext,forwardRef,useContext,useSyncExternalStore,type PropsWithChildren} from 'react';
import {Text as RNText,TextInput as RNTextInput,type TextProps,type TextInputProps} from 'react-native';
import {emptyFonts,type FontCatalog} from '../storage/fontCatalog.ts';
const GlobalFont=createContext<string|undefined>(undefined),emptySubscribe=()=>()=>{},emptySnapshot=()=>emptyFonts;
export function TypographyProvider({store,children}:PropsWithChildren<{store?:FontCatalog}>){
  const fonts=useSyncExternalStore(store?.subscribe??emptySubscribe,store?.getSnapshot??emptySnapshot);
  return <GlobalFont.Provider value={fonts.global??undefined}>{children}</GlobalFont.Provider>;
}
export const Text=forwardRef<RNText,TextProps>(function Text({style,...props},ref){
  const family=useContext(GlobalFont);return <RNText {...props} ref={ref} style={[family?{fontFamily:family}:undefined,style]}/>;
});
export const TextInput=forwardRef<RNTextInput,TextInputProps>(function TextInput({style,...props},ref){
  const family=useContext(GlobalFont);return <RNTextInput {...props} ref={ref} style={[family?{fontFamily:family}:undefined,style]}/>;
});
