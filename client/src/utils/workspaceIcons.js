import {
  Sparkles, Briefcase, Rocket, Folder, Layers, Flag, Zap, Leaf, Compass, Target,
  Globe, Heart, Star, BookOpen, PenTool, LayoutGrid, Code, Palette, Camera, Music,
  Film, Mic, Image, Paintbrush, Feather, Pencil, House, Building2, Store, Coffee,
  Utensils, Plane, Car, Dumbbell, Gamepad2, GraduationCap, FlaskConical, Lightbulb,
  Flame, Cloud, Database, Terminal, Cpu, Bug, DollarSign, TrendingUp, ChartColumn,
  Users, CalendarDays, Clock, Bell, Bookmark, Gift, Shield, Map, MapPin, Package,
  Box, Scissors, Wrench, Hammer, Anchor, Moon, Sun,
} from 'lucide-vue-next';

// Workspace icons drawn from Lucide (open-source icon library). Stored on the
// workspace as the key string, so any future user picks from real, recognizable
// icons. Legacy single-letter icons still render as text via WorkspaceIcon's
// fallback, and the earlier keys are preserved so no existing workspace loses
// its icon.
export const WS_ICONS = {
  // preserved keys (workspaces migrated to these keep their icon)
  sparkles: Sparkles, briefcase: Briefcase, rocket: Rocket, folder: Folder,
  layers: Layers, flag: Flag, bolt: Zap, leaf: Leaf, compass: Compass,
  target: Target, globe: Globe, heart: Heart, star: Star, book: BookOpen,
  pen: PenTool, grid: LayoutGrid,
  // creative
  code: Code, palette: Palette, camera: Camera, music: Music, film: Film,
  mic: Mic, image: Image, brush: Paintbrush, feather: Feather, pencil: Pencil,
  // places & life
  home: House, building: Building2, store: Store, coffee: Coffee,
  food: Utensils, plane: Plane, car: Car, gym: Dumbbell, game: Gamepad2,
  school: GraduationCap, science: FlaskConical,
  // product & tech
  idea: Lightbulb, flame: Flame, cloud: Cloud, database: Database,
  terminal: Terminal, cpu: Cpu, bug: Bug,
  // business & organizing
  money: DollarSign, growth: TrendingUp, chart: ChartColumn, users: Users,
  calendar: CalendarDays, clock: Clock, bell: Bell, bookmark: Bookmark,
  gift: Gift, shield: Shield, map: Map, pin: MapPin, package: Package,
  box: Box, scissors: Scissors, wrench: Wrench, hammer: Hammer, anchor: Anchor,
  moon: Moon, sun: Sun,
};

export const WS_ICON_KEYS = Object.keys(WS_ICONS);
