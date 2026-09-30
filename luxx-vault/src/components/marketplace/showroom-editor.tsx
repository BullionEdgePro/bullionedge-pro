"use client";

import { useActionState, useState } from "react";
import { Checkbox, Field, FormAlert, Input } from "@/components/ui/field";
import { updateShowroom } from "@/lib/server/marketplace/actions/account";
import { SubmitButton } from "./action-form";
import { PhotoUploader, type UploadedPhoto } from "./photo-uploader";

/** Showroom tagline and cover photo. Profile details (bio, city, tools) live in Account › Profile. */
export function ShowroomEditor({ tagline, cover }: { tagline: string; cover: UploadedPhoto | null }) {
  const [state, action] = useActionState(updateShowroom, null);
  const [photo, setPhoto] = useState<UploadedPhoto | null>(cover);
  const [text, setText] = useState(tagline);
  return (
    <form action={action} noValidate className="grid gap-6">
      <input type="hidden" name="coverMediaId" value={photo && photo.id !== cover?.id ? photo.id : ""} />
      <PhotoUploader
        name="coverPhotos"
        purpose="showroom_cover"
        max={1}
        initial={cover ? [cover] : []}
        onChange={(list) => setPhoto(list[0] ?? null)}
        label="Cover photo"
        hint="A wide photo of your counter, display or pieces. It sits behind your name. Location data is removed."
      />
      {cover && <Checkbox name="removeCover" value="1" label="Remove the cover and use the velvet default" />}
      <Field label="Tagline" hint={`${text.length}/120 · One line under your name, e.g. “Saudi gold, weighed in front of you.”`} error={state?.fieldErrors?.tagline}>
        {(p) => <Input {...p} name="tagline" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} />}
      </Field>
      {state?.error && <FormAlert>{state.error}</FormAlert>}
      <SubmitButton className="w-fit" pendingLabel="Saving…">
        Save showroom
      </SubmitButton>
    </form>
  );
}
