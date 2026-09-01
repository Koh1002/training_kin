'use client'

import { RecordFab } from '@/components/record-fab'
import { SetForm } from '@/components/workout/set-form'
import { VoiceCapture } from '@/components/workout/voice-capture'
import type { ExerciseWithMuscles, SetLoadRow } from '@/types/database'

type Props = {
  today: string
  exercises: ExerciseWithMuscles[]
  lastInputs: Record<string, Pick<SetLoadRow, 'weight_kg' | 'reps' | 'sets' | 'duration_min' | 'hold_sec' | 'speed' | 'incline_deg' | 'date'>>
  recentExerciseIds: string[]
  bodyweightKg: number
}

/**
 * 筋トレの記録シート。声と手入力の両方をここにまとめる。
 * 入力そのものは既存の SetForm をそのまま使う（作り直さない）。
 */
export function WorkoutRecordSheet({ today, exercises, lastInputs, recentExerciseIds, bodyweightKg }: Props) {
  return (
    <RecordFab title="筋トレを記録" defaultDate={today}>
      {({ date, refresh }) => (
        <div className="space-y-5">
          <VoiceCapture date={date} exercises={exercises} onSaved={refresh} />

          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-medium tracking-wider text-muted uppercase">
              選んで入力
            </h3>
            <SetForm
              date={date}
              exercises={exercises}
              lastInputs={lastInputs}
              recentExerciseIds={recentExerciseIds}
              bodyweightKg={bodyweightKg}
              onAdded={refresh}
            />
          </div>
        </div>
      )}
    </RecordFab>
  )
}
