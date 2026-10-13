export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          detail: Json | null;
          id: string;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          detail?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          detail?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name_en: string;
          name_kk: string;
          name_ru: string;
          position: number;
          slug: string;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_kk: string;
          name_ru: string;
          position?: number;
          slug: string;
        };
        Update: {
          id?: string;
          name_en?: string;
          name_kk?: string;
          name_ru?: string;
          position?: number;
          slug?: string;
        };
        Relationships: [];
      };
      classroom_memberships: {
        Row: {
          classroom_id: string;
          ended_at: string | null;
          id: string;
          joined_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          classroom_id: string;
          ended_at?: string | null;
          id?: string;
          joined_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          classroom_id?: string;
          ended_at?: string | null;
          id?: string;
          joined_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      classrooms: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          join_code: string;
          name: string;
          organization_id: string;
          status: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          join_code: string;
          name: string;
          organization_id: string;
          status?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          join_code?: string;
          name?: string;
          organization_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string;
          estimated_minutes: number;
          id: string;
          language: string;
          level: Database["public"]["Enums"]["course_level"];
          organization_id: string;
          preview_seconds: number;
          price_kzt: number;
          price_model: Database["public"]["Enums"]["price_model"];
          published_at: string | null;
          rejection_reason: string | null;
          short_description: string;
          slug: string;
          status: Database["public"]["Enums"]["course_status"];
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description?: string;
          estimated_minutes?: number;
          id?: string;
          language?: string;
          level?: Database["public"]["Enums"]["course_level"];
          organization_id: string;
          preview_seconds?: number;
          price_kzt?: number;
          price_model?: Database["public"]["Enums"]["price_model"];
          published_at?: string | null;
          rejection_reason?: string | null;
          short_description?: string;
          slug: string;
          status?: Database["public"]["Enums"]["course_status"];
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string;
          estimated_minutes?: number;
          id?: string;
          language?: string;
          level?: Database["public"]["Enums"]["course_level"];
          organization_id?: string;
          preview_seconds?: number;
          price_kzt?: number;
          price_model?: Database["public"]["Enums"]["price_model"];
          published_at?: string | null;
          rejection_reason?: string | null;
          short_description?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["course_status"];
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      danmaku: {
        Row: {
          color: string;
          course_id: string;
          created_at: string;
          hidden: boolean;
          id: string;
          lesson_id: string;
          mode: string;
          text: string;
          time_ms: number;
          user_id: string;
        };
        Insert: {
          color?: string;
          course_id: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          lesson_id: string;
          mode?: string;
          text: string;
          time_ms: number;
          user_id: string;
        };
        Update: {
          color?: string;
          course_id?: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          lesson_id?: string;
          mode?: string;
          text?: string;
          time_ms?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "danmaku_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "danmaku_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      danmaku_blocks: {
        Row: {
          course_id: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          user_id: string;
        };
        Insert: {
          course_id?: string | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          user_id: string;
        };
        Update: {
          course_id?: string | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "danmaku_blocks_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "danmaku_blocks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_replies: {
        Row: {
          body: string;
          course_id: string;
          created_at: string;
          hidden: boolean;
          id: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          course_id: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          course_id?: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_replies_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_replies_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "discussion_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_threads: {
        Row: {
          body: string;
          course_id: string;
          created_at: string;
          hidden: boolean;
          id: string;
          lesson_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          course_id: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          lesson_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          course_id?: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          lesson_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_threads_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_threads_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      homework: {
        Row: {
          allow_file: boolean;
          allow_text: boolean;
          course_id: string;
          created_at: string;
          id: string;
          instructions: string;
          lesson_id: string;
          max_score: number | null;
          required: boolean;
        };
        Insert: {
          allow_file?: boolean;
          allow_text?: boolean;
          course_id: string;
          created_at?: string;
          id?: string;
          instructions?: string;
          lesson_id: string;
          max_score?: number | null;
          required?: boolean;
        };
        Update: {
          allow_file?: boolean;
          allow_text?: boolean;
          course_id?: string;
          created_at?: string;
          id?: string;
          instructions?: string;
          lesson_id?: string;
          max_score?: number | null;
          required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "homework_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: true;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_submissions: {
        Row: {
          body: string;
          course_id: string;
          feedback: string | null;
          file_paths: string[];
          homework_id: string;
          id: string;
          lesson_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          score: number | null;
          status: Database["public"]["Enums"]["submission_status"];
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          course_id: string;
          feedback?: string | null;
          file_paths?: string[];
          homework_id: string;
          id?: string;
          lesson_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          score?: number | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          course_id?: string;
          feedback?: string | null;
          file_paths?: string[];
          homework_id?: string;
          id?: string;
          lesson_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          score?: number | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_submissions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_submissions_homework_id_fkey";
            columns: ["homework_id"];
            isOneToOne: false;
            referencedRelation: "homework";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_submissions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completed: boolean;
          completed_at: string;
          course_id: string;
          id: string;
          lesson_id: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string;
          course_id: string;
          id?: string;
          lesson_id: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string;
          course_id?: string;
          id?: string;
          lesson_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_resources: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          lesson_id: string;
          media_path: string;
          position: number;
          title: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          lesson_id: string;
          media_path: string;
          position?: number;
          title: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          lesson_id?: string;
          media_path?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_resources_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          body: string | null;
          course_id: string;
          created_at: string;
          danmaku_enabled: boolean;
          discussion_enabled: boolean;
          duration_minutes: number;
          id: string;
          is_preview: boolean;
          media_path: string | null;
          position: number;
          section_id: string;
          title: string;
          type: Database["public"]["Enums"]["lesson_type"];
        };
        Insert: {
          body?: string | null;
          course_id: string;
          created_at?: string;
          danmaku_enabled?: boolean;
          discussion_enabled?: boolean;
          duration_minutes?: number;
          id?: string;
          is_preview?: boolean;
          media_path?: string | null;
          position?: number;
          section_id: string;
          title: string;
          type?: Database["public"]["Enums"]["lesson_type"];
        };
        Update: {
          body?: string | null;
          course_id?: string;
          created_at?: string;
          danmaku_enabled?: boolean;
          discussion_enabled?: boolean;
          duration_minutes?: number;
          id?: string;
          is_preview?: boolean;
          media_path?: string | null;
          position?: number;
          section_id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["lesson_type"];
        };
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      org_subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          id: string;
          organization_id: string;
          plan_code: string;
          provider: string;
          provider_ref: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          organization_id: string;
          plan_code: string;
          provider?: string;
          provider_ref?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          organization_id?: string;
          plan_code?: string;
          provider?: string;
          provider_ref?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_subscriptions_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "teacher_plans";
            referencedColumns: ["code"];
          },
        ];
      };
      organizations: {
        Row: {
          about: string | null;
          cover_url: string | null;
          created_at: string;
          headline: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          owner_id: string;
          slug: string;
        };
        Insert: {
          about?: string | null;
          cover_url?: string | null;
          created_at?: string;
          headline?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          owner_id: string;
          slug: string;
        };
        Update: {
          about?: string | null;
          cover_url?: string | null;
          created_at?: string;
          headline?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string;
          slug?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_kzt: number;
          created_at: string;
          id: string;
          provider: string;
          provider_ref: string | null;
          status: string;
          subscription_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_kzt?: number;
          created_at?: string;
          id?: string;
          provider?: string;
          provider_ref?: string | null;
          status?: string;
          subscription_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_kzt?: number;
          created_at?: string;
          id?: string;
          provider?: string;
          provider_ref?: string | null;
          status?: string;
          subscription_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          default_mode: string;
          full_name: string;
          id: string;
          preferred_locale: string;
          suspended: boolean;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          default_mode?: string;
          full_name?: string;
          id: string;
          preferred_locale?: string;
          suspended?: boolean;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          default_mode?: string;
          full_name?: string;
          id?: string;
          preferred_locale?: string;
          suspended?: boolean;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          answers: Json;
          course_id: string;
          created_at: string;
          id: string;
          lesson_id: string;
          passed: boolean;
          quiz_id: string;
          score: number;
          total: number;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          course_id: string;
          created_at?: string;
          id?: string;
          lesson_id: string;
          passed: boolean;
          quiz_id: string;
          score: number;
          total: number;
          user_id: string;
        };
        Update: {
          answers?: Json;
          course_id?: string;
          created_at?: string;
          id?: string;
          lesson_id?: string;
          passed?: boolean;
          quiz_id?: string;
          score?: number;
          total?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_options: {
        Row: {
          course_id: string;
          id: string;
          is_correct: boolean;
          position: number;
          question_id: string;
          text: string;
        };
        Insert: {
          course_id: string;
          id?: string;
          is_correct?: boolean;
          position?: number;
          question_id: string;
          text: string;
        };
        Update: {
          course_id?: string;
          id?: string;
          is_correct?: boolean;
          position?: number;
          question_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_options_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "quiz_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_questions: {
        Row: {
          course_id: string;
          explanation: string;
          id: string;
          position: number;
          question: string;
          quiz_id: string;
        };
        Insert: {
          course_id: string;
          explanation?: string;
          id?: string;
          position?: number;
          question: string;
          quiz_id: string;
        };
        Update: {
          course_id?: string;
          explanation?: string;
          id?: string;
          position?: number;
          question?: string;
          quiz_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          lesson_id: string;
          passing_score: number;
          required: boolean;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          lesson_id: string;
          passing_score?: number;
          required?: boolean;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          lesson_id?: string;
          passing_score?: number;
          required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: true;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          admin_note: string | null;
          created_at: string;
          description: string;
          id: string;
          reason: string;
          reporter_id: string;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
        };
        Insert: {
          admin_note?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reason: string;
          reporter_id: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
        };
        Update: {
          admin_note?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target_type"];
        };
        Relationships: [];
      };
      sections: {
        Row: {
          course_id: string;
          id: string;
          position: number;
          title: string;
        };
        Insert: {
          course_id: string;
          id?: string;
          position?: number;
          title: string;
        };
        Update: {
          course_id?: string;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sections_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancelled_at: string | null;
          course_id: string;
          current_period_end: string | null;
          id: string;
          price_kzt: number;
          provider: string;
          provider_ref: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          user_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          course_id: string;
          current_period_end?: string | null;
          id?: string;
          price_kzt?: number;
          provider?: string;
          provider_ref?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          user_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          course_id?: string;
          current_period_end?: string | null;
          id?: string;
          price_kzt?: number;
          provider?: string;
          provider_ref?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_plans: {
        Row: {
          code: string;
          id: string;
          max_courses: number | null;
          max_students: number | null;
          name: string;
          position: number;
          price_kzt: number;
        };
        Insert: {
          code: string;
          id?: string;
          max_courses?: number | null;
          max_students?: number | null;
          name: string;
          position?: number;
          price_kzt?: number;
        };
        Update: {
          code?: string;
          id?: string;
          max_courses?: number | null;
          max_students?: number | null;
          name?: string;
          position?: number;
          price_kzt?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_edit_course: { Args: { _course: string }; Returns: boolean };
      course_is_published: { Args: { _course: string }; Returns: boolean };
      course_stats: {
        Args: never;
        Returns: {
          course_id: string;
          recent: number;
          students: number;
        }[];
      };
      create_classroom: { Args: { _course: string; _name: string }; Returns: string };
      enroll_free_course: {
        Args: { _course: string; _user: string };
        Returns: string;
      };
      get_classroom_join_code: { Args: { _classroom: string }; Returns: string };
      has_course_access: {
        Args: { _course: string; _user: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      join_classroom: { Args: { _code: string }; Returns: string };
      leave_classroom: { Args: { _classroom: string }; Returns: undefined };
      owns_org: { Args: { _org: string }; Returns: boolean };
      remove_classroom_member: {
        Args: { _classroom: string; _user: string };
        Returns: undefined;
      };
      rotate_classroom_join_code: { Args: { _classroom: string }; Returns: string };
      set_classroom_status: {
        Args: { _classroom: string; _status: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "student" | "teacher" | "admin";
      course_level: "beginner" | "intermediate" | "advanced";
      course_status: "draft" | "pending_review" | "published" | "rejected" | "archived";
      lesson_type: "video" | "text" | "file";
      price_model: "free" | "subscription";
      report_status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
      report_target_type: "course" | "teacher" | "lesson" | "danmaku";
      submission_status: "submitted" | "needs_revision" | "reviewed";
      subscription_status: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "PAYMENT_FAILED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin"],
      course_level: ["beginner", "intermediate", "advanced"],
      course_status: ["draft", "pending_review", "published", "rejected", "archived"],
      lesson_type: ["video", "text", "file"],
      price_model: ["free", "subscription"],
      report_status: ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"],
      report_target_type: ["course", "teacher", "lesson", "danmaku"],
      submission_status: ["submitted", "needs_revision", "reviewed"],
      subscription_status: ["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "PAYMENT_FAILED"],
    },
  },
} as const;
