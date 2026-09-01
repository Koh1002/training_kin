'use client'

import { RecordFab } from '@/components/record-fab'
import { LogForm } from '@/components/english/log-form'
import type { EnglishActivity, SkillCode } from '@/types/database'

type Props = {
  today: string
  activities: EnglishActivity[]
  defaultSkill: SkillCode
}

/** 英語の記録シート。中身は既存の LogForm をそのまま使う。 */
export function EnglishRecordSheet({ today, activities, defaultSkill }: Props) {
  return (
    <RecordFab title="英語を記録" defaultDate={today}>
      {({ date, refresh }) => (
        <LogForm
          date={date}
          activities={activities}
          defaultSkill={defaultSkill}
          onAdded={refresh}
        />
      )}
    </RecordFab>
  )
}
