declare module 'vue-iconsax' {
  import type { DefineComponent } from 'vue';

  export type VsxIconType = 'linear' | 'outline' | 'twotone' | 'bulk' | 'broken' | 'bold';

  export interface VsxIconProps {
    iconName: string;
    color?: string;
    size?: string | number;
    type?: VsxIconType;
  }

  export const VsxIcon: DefineComponent<VsxIconProps>;
}
