// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSettingsStore } from "~/core/store/settings-store";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

interface TtsSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSave: (settings: TtsSettings) => void;
  initialSettings: TtsSettings;
}

interface TtsSettings {
  model: string;
  voiceType: string;
  voiceType2: string;
  speedRatio: number;
  volumeRatio: number;
  pitchRatio: number;
  apiKey: string;
  endpoint: string;
  siliconflowApiKey: string;
  siliconflowModel: string;
  siliconflowVoice: string;
  siliconflowVoice2: string;
  siliconflowSpeed: number;
  siliconflowGain: number;
  minimaxApiKey: string;
  minimaxVoiceId: string;
  minimaxVoiceId2: string;
  minimaxSpeed: number;
  minimaxVol: number;
  minimaxPitch: number;
}

export function TtsSetupDialog({ open, onOpenChange, onSettingsSave, initialSettings }: TtsSetupDialogProps) {
  const t = useTranslations("report");
  const [settings, setSettings] = useState<TtsSettings>(initialSettings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSiliconflowApiKey, setShowSiliconflowApiKey] = useState(false);
  const { general } = useSettingsStore();

  const handleSave = () => {
    onSettingsSave(settings);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('ttsModel', settings.model);
      localStorage.setItem('siliconflowApiKey', settings.siliconflowApiKey || '');
      localStorage.setItem('siliconflowVoice', settings.siliconflowVoice || '');
      localStorage.setItem('siliconflowVoice2', settings.siliconflowVoice2 || settings.siliconflowVoice || '');
      localStorage.setItem('siliconflowSpeed', (settings.siliconflowSpeed || 1.0).toString());
      localStorage.setItem('siliconflowGain', (settings.siliconflowGain || 0.0).toString());
      
      // Save MiniMax settings
      localStorage.setItem('minimaxApiKey', settings.minimaxApiKey || '');
      localStorage.setItem('minimaxVoiceId', settings.minimaxVoiceId || '');
      localStorage.setItem('minimaxVoiceId2', settings.minimaxVoiceId2 || settings.minimaxVoiceId || '');
      localStorage.setItem('minimaxSpeed', (settings.minimaxSpeed || 1.0).toString());
      localStorage.setItem('minimaxVol', (settings.minimaxVol || 1.0).toString());
      localStorage.setItem('minimaxPitch', (settings.minimaxPitch || 0).toString());
      
      // Save voice types for non-SiliconFlow models
      if (!(settings.model.includes("CosyVoice") || settings.model.includes("MOSS") || settings.model.includes("speech-2.6"))) {
        localStorage.setItem('voiceType', settings.voiceType);
        localStorage.setItem('voiceType2', settings.voiceType2 || settings.voiceType);
        localStorage.setItem('speedRatio', settings.speedRatio.toString());
        localStorage.setItem('volumeRatio', settings.volumeRatio.toString());
        localStorage.setItem('pitchRatio', settings.pitchRatio.toString());
      }
    }
    
    onOpenChange(false);
  };

  const handleReset = () => {
    setSettings(initialSettings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("ttsSettings") || "TTS设置"}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* API Key */}
          <div className="md:col-span-2">
            <Label htmlFor="api-key" className="text-sm font-medium">
              {t("siliconflowApiKey") || "SiliconFlow API密钥"}
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? "text" : "password"}
                value={settings.siliconflowApiKey || ""}
                onChange={(e) => setSettings({...settings, siliconflowApiKey: e.target.value})}
                placeholder={t("enterSiliconflowApiKey") || "输入SiliconFlow API密钥"}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* TTS Model */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {t("ttsModel") || "TTS模型"}
            </Label>
            <Select value={settings.model || "FunAudioLLM/CosyVoice2-0.5B"} onValueChange={(value) => setSettings({...settings, model: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FunAudioLLM/CosyVoice2-0.5B">{t("cosyvoiceModel") || "CosyVoice2-0.5B"}</SelectItem>
                <SelectItem value="fnlp/MOSS-TTSD-v0.5">{t("mossModel") || "MOSS-TTSD-v0.5"}</SelectItem>
                <SelectItem value="speech-2.6-hd">{t("minimax26hdModel") || "MiniMax 2.6 HD"}</SelectItem>
                <SelectItem value="speech-2.6-turbo">{t("minimax26turboModel") || "MiniMax 2.6 Turbo"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Voice Type 1 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {t("voiceType1") || "声音类型1"}
            </Label>
            {settings.model.includes("CosyVoice") || settings.model.includes("MOSS") ? (
              <Select value={settings.siliconflowVoice || "alex"} onValueChange={(value) => setSettings({...settings, siliconflowVoice: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alex">{t("alexVoice") || "沉稳男声 (alex) - SiliconFlow"}</SelectItem>
                  <SelectItem value="benjamin">{t("benjaminVoice") || "低沉男声 (benjamin) - SiliconFlow"}</SelectItem>
                  <SelectItem value="charles">{t("charlesVoice") || "磁性男声 (charles) - SiliconFlow"}</SelectItem>
                  <SelectItem value="david">{t("davidVoice") || "欢快男声 (david) - SiliconFlow"}</SelectItem>
                  <SelectItem value="anna">{t("annaVoice") || "沉稳女声 (anna) - SiliconFlow"}</SelectItem>
                  <SelectItem value="bella">{t("bellaVoice") || "激情女声 (bella) - SiliconFlow"}</SelectItem>
                  <SelectItem value="claire">{t("claireVoice") || "温柔女声 (claire) - SiliconFlow"}</SelectItem>
                  <SelectItem value="diana">{t("dianaVoice") || "欢快女声 (diana) - SiliconFlow"}</SelectItem>
                </SelectContent>
              </Select>
            ) : settings.model.includes("speech-2.6") ? (
              <Select value={settings.minimaxVoiceId || "male-qn-qingse"} onValueChange={(value) => setSettings({...settings, minimaxVoiceId: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male-qn-qingse">青涩青年音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-shaonv">少女音色 (MiniMax)</SelectItem>
                  <SelectItem value="male-qn-jingying">精英青年音色 (MiniMax)</SelectItem>
                  <SelectItem value="male-qn-badao">霸道青年音色 (MiniMax)</SelectItem>
                  <SelectItem value="male-qn-daxuesheng">青年大学生音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-yujie">御姐音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-chengshu">成熟女性音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-tianmei">甜美女性音色 (MiniMax)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={settings.voiceType || "alloy"} onValueChange={(value) => setSettings({...settings, voiceType: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Voice Type 2 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {t("voiceType2") || "声音类型2"}
            </Label>
            {settings.model.includes("CosyVoice") || settings.model.includes("MOSS") ? (
              <Select value={settings.siliconflowVoice2 || settings.siliconflowVoice || "alex"} onValueChange={(value) => setSettings({...settings, siliconflowVoice2: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alex">{t("alexVoice") || "沉稳男声 (alex) - SiliconFlow"}</SelectItem>
                  <SelectItem value="benjamin">{t("benjaminVoice") || "低沉男声 (benjamin) - SiliconFlow"}</SelectItem>
                  <SelectItem value="charles">{t("charlesVoice") || "磁性男声 (charles) - SiliconFlow"}</SelectItem>
                  <SelectItem value="david">{t("davidVoice") || "欢快男声 (david) - SiliconFlow"}</SelectItem>
                  <SelectItem value="anna">{t("annaVoice") || "沉稳女声 (anna) - SiliconFlow"}</SelectItem>
                  <SelectItem value="bella">{t("bellaVoice") || "激情女声 (bella) - SiliconFlow"}</SelectItem>
                  <SelectItem value="claire">{t("claireVoice") || "温柔女声 (claire) - SiliconFlow"}</SelectItem>
                  <SelectItem value="diana">{t("dianaVoice") || "欢快女声 (diana) - SiliconFlow"}</SelectItem>
                </SelectContent>
              </Select>
            ) : settings.model.includes("speech-2.6") ? (
              <Select value={settings.minimaxVoiceId2 || settings.minimaxVoiceId || "female-shaonv"} onValueChange={(value) => setSettings({...settings, minimaxVoiceId2: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male-qn-qingse">青涩青年音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-shaonv">少女音色 (MiniMax)</SelectItem>
                  <SelectItem value="male-qn-jingying">精英青年音色 (MiniMax)</SelectItem>
                  <SelectItem value="male-qn-badao">霸道青年音色 (MiniMax)</SelectItem>
                  <SelectItem value="male-qn-daxuesheng">青年大学生音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-yujie">御姐音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-chengshu">成熟女性音色 (MiniMax)</SelectItem>
                  <SelectItem value="female-tianmei">甜美女性音色 (MiniMax)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={settings.voiceType2 || settings.voiceType || "alloy"} onValueChange={(value) => setSettings({...settings, voiceType2: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Speed Ratio */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {t("speedRatio") || "语速"}: 
              {settings.model.includes("CosyVoice") || settings.model.includes("MOSS") ? 
                (settings.siliconflowSpeed || 1.0).toFixed(1) : 
                settings.model.includes("speech-2.6") ? 
                (settings.minimaxSpeed || 1.0).toFixed(1) : 
                (settings.speedRatio || 1.0).toFixed(1)
              }x
            </Label>
            {settings.model.includes("CosyVoice") || settings.model.includes("MOSS") ? (
              <Slider
                value={[settings.siliconflowSpeed || 1.0]}
                onValueChange={([value]) => setSettings({...settings, siliconflowSpeed: value})}
                min={0.25}
                max={4.0}
                step={0.1}
                className="w-full"
              />
            ) : settings.model.includes("speech-2.6") ? (
              <Slider
                value={[settings.minimaxSpeed || 1.0]}
                onValueChange={([value]) => setSettings({...settings, minimaxSpeed: value})}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            ) : (
              <Slider
                value={[settings.speedRatio || 1.0]}
                onValueChange={([value]) => setSettings({...settings, speedRatio: value})}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            )}
          </div>
          
          {/* Volume/Gain */}
          <div>
            {settings.model.includes("CosyVoice") || settings.model.includes("MOSS") ? (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t("siliconflowGain") || "增益"}: {(settings.siliconflowGain || 0).toFixed(1)} dB
                </Label>
                <Slider
                  value={[settings.siliconflowGain || 0]}
                  onValueChange={([value]) => setSettings({...settings, siliconflowGain: value})}
                  min={-10}
                  max={10}
                  step={0.1}
                  className="w-full"
                />
              </div>
            ) : settings.model.includes("speech-2.6") ? (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t("minimaxVol") || "音量"}: {(settings.minimaxVol || 1.0).toFixed(1)}
                </Label>
                <Slider
                  value={[settings.minimaxVol || 1.0]}
                  onValueChange={([value]) => setSettings({...settings, minimaxVol: value})}
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  className="w-full"
                />
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t("volumeRatio") || "音量"}: {(settings.volumeRatio || 1.0).toFixed(1)}x
                </Label>
                <Slider
                  value={[settings.volumeRatio || 1.0]}
                  onValueChange={([value]) => setSettings({...settings, volumeRatio: value})}
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          {/* MiniMax API Key */}
          {(settings.model === "speech-2.6-hd" || settings.model === "speech-2.6-turbo") && (
            <div className="md:col-span-2">
              <Label htmlFor="minimax-api-key" className="text-sm font-medium">
                {t("minimaxApiKey") || "MiniMax API密钥"}
              </Label>
              <div className="relative">
                <Input
                  id="minimax-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={settings.minimaxApiKey || ""}
                  onChange={(e) => setSettings({...settings, minimaxApiKey: e.target.value})}
                  placeholder={t("enterMinimaxApiKey") || "输入MiniMax API密钥"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* SiliconFlow Model */}
          {settings.model === "siliconflow-tts" && (
            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">
                {t("siliconflowModel") || "SiliconFlow模型"}
              </Label>
              <Select value={settings.siliconflowModel || "FunAudioLLM/CosyVoice2-0.5B"} onValueChange={(value) => setSettings({...settings, siliconflowModel: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FunAudioLLM/CosyVoice2-0.5B">FunAudioLLM/CosyVoice2-0.5B</SelectItem>
                  <SelectItem value="fishaudio/fish-speech-1.4">fishaudio/fish-speech-1.4</SelectItem>
                  <SelectItem value="fnlp/MOSS-TTSD-v0.5">fnlp/MOSS-TTSD-v0.5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          
          
          {/* Pitch Ratio - Only for non-SiliconFlow and non-MiniMax models */}
          {!settings.model.includes("CosyVoice") && !settings.model.includes("MOSS") && !settings.model.includes("speech-2.6") && (
            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">
                {t("pitchRatio") || "音高"}: {(settings.pitchRatio || 1.0).toFixed(1)}x
              </Label>
              <Slider
                value={[settings.pitchRatio || 1.0]}
                onValueChange={([value]) => setSettings({...settings, pitchRatio: value})}
                min={0.5}
                max={1.5}
                step={0.1}
                className="w-full"
              />
            </div>
          )}
          
          {/* MiniMax Pitch Control */}
          {settings.model.includes("speech-2.6") && (
            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">
                {t("minimaxPitch") || "音高"}: {(settings.minimaxPitch || 0)}
              </Label>
              <Slider
                value={[settings.minimaxPitch || 0]}
                onValueChange={([value]) => setSettings({...settings, minimaxPitch: value})}
                min={-20}
                max={20}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <div>
            <Button variant="outline" onClick={handleReset}>
              {t("reset") || "重置"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={async () => {
                onSettingsSave(settings);
                
                // Save to localStorage
                if (typeof window !== 'undefined') {
                  localStorage.setItem('ttsModel', settings.model);
                  localStorage.setItem('siliconflowApiKey', settings.siliconflowApiKey || '');
                  localStorage.setItem('siliconflowVoice', settings.siliconflowVoice || '');
                  localStorage.setItem('siliconflowVoice2', settings.siliconflowVoice2 || settings.siliconflowVoice || '');
                  localStorage.setItem('siliconflowSpeed', (settings.siliconflowSpeed || 1.0).toString());
                  localStorage.setItem('siliconflowGain', (settings.siliconflowGain || 0.0).toString());
                  
                  // Save MiniMax settings
                  if (settings.model.includes("speech-2.6")) {
                    localStorage.setItem('minimaxApiKey', settings.minimaxApiKey || '');
                    localStorage.setItem('minimaxVoiceId', settings.minimaxVoiceId || '');
                    localStorage.setItem('minimaxVoiceId2', settings.minimaxVoiceId2 || settings.minimaxVoiceId || '');
                    localStorage.setItem('minimaxSpeed', (settings.minimaxSpeed || 1.0).toString());
                    localStorage.setItem('minimaxVol', (settings.minimaxVol || 1.0).toString());
                    localStorage.setItem('minimaxPitch', (settings.minimaxPitch || 0).toString());
                  }
                  
                  
                  // Save voice types for non-SiliconFlow models
                  if (!(settings.model.includes("CosyVoice") || settings.model.includes("MOSS") || settings.model.includes("speech-2.6"))) {
                    localStorage.setItem('voiceType', settings.voiceType);
                    localStorage.setItem('voiceType2', settings.voiceType2 || settings.voiceType);
                    localStorage.setItem('speedRatio', settings.speedRatio.toString());
                    localStorage.setItem('volumeRatio', settings.volumeRatio.toString());
                    localStorage.setItem('pitchRatio', settings.pitchRatio.toString());
                  }
                }
                
                // Test TTS functionality with dialogue content
                const dialogueTexts = [
                  "bug已经充满了你的电脑",
                  "是啊，听起来就像电脑真的被虫子占领了一样",
                  "不过从技术角度来说，bug确实会让程序变得很混乱"
                ];
                
                // Determine voices based on selected voice types
                let voice1, voice2;
                if (settings.model.includes("CosyVoice") || settings.model.includes("MOSS")) {
                  voice1 = settings.siliconflowVoice;
                  voice2 = settings.siliconflowVoice2 || settings.siliconflowVoice;
                } else if (settings.model.includes("speech-2.6")) {
                  voice1 = settings.minimaxVoiceId;
                  voice2 = settings.minimaxVoiceId2 || settings.minimaxVoiceId;
                } else {
                  voice1 = settings.voiceType;
                  voice2 = settings.voiceType2 || settings.voiceType;
                }
                
                // Create alternating voices for dialogue effect
                const voices = [voice1, voice2, voice1]; // Alternate between two voices
                
                // Validate API keys before proceeding
                if (settings.model.includes("CosyVoice") || settings.model.includes("MOSS")) {
                  if (!settings.siliconflowApiKey) {
                    alert("请先输入 SiliconFlow API 密钥");
                    return;
                  }
                } else if (settings.model.includes("speech-2.6")) {
                  if (!settings.minimaxApiKey) {
                    alert("请先输入 MiniMax API 密钥");
                    return;
                  }
                }
                
                try {
                  for (let i = 0; i < dialogueTexts.length; i++) {
                    let requestBody: any = {
                      text: dialogueTexts[i],
                      encoding: "mp3"
                    };
                    
                    if (settings.model.includes("CosyVoice") || settings.model.includes("MOSS")) {
                      // SiliconFlow TTS
                      requestBody = {
                        ...requestBody,
                        model: settings.model,
                        siliconflow_api_key: settings.siliconflowApiKey,
                        siliconflow_voice: voices[i],
                        siliconflow_speed: settings.siliconflowSpeed,
                        siliconflow_gain: settings.siliconflowGain
                      };
                    } else if (settings.model.includes("speech-2.6")) {
                      // MiniMax TTS
                      requestBody = {
                        ...requestBody,
                        model: settings.model,
                        minimax_api_key: settings.minimaxApiKey,
                        minimax_voice_id: voices[i],
                        minimax_speed: settings.minimaxSpeed,
                        minimax_vol: settings.minimaxVol,
                        minimax_pitch: settings.minimaxPitch,
                        audio_format: "mp3"
                      };
                    } else {
                      // Default TTS
                      requestBody = {
                        ...requestBody,
                        model: settings.model,
                        voice_type: voices[i],
                        speed_ratio: settings.speedRatio,
                        volume_ratio: settings.volumeRatio,
                        pitch_ratio: settings.pitchRatio
                      };
                    }
                    
                    const response = await fetch("http://localhost:8000/api/tts", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(requestBody),
                    });

                    if (response.ok) {
                      const audioBlob = await response.blob();
                      const audioUrl = URL.createObjectURL(audioBlob);
                      const audio = new Audio(audioUrl);
                      audio.play();
                      
                      // Wait for current audio to finish before playing next
                      await new Promise(resolve => {
                        audio.onended = resolve;
                      });
                      
                      // Clean up the object URL after playback
                      URL.revokeObjectURL(audioUrl);
                    } else {
                      console.error("TTS test failed:", response.statusText);
                      alert("试听失败，请检查配置");
                      break;
                    }
                  }
                } catch (error) {
                  console.error("TTS test error:", error);
                  alert("试听失败，请检查配置和网络连接");
                }
              }}
            >
              对话试听
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}