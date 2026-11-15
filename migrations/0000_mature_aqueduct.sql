CREATE TABLE `absensi` (
	`pertemuan_id` text NOT NULL,
	`santri_id` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`pertemuan_id`) REFERENCES `pertemuan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`santri_id`) REFERENCES `santri`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `absensi_uq` ON `absensi` (`pertemuan_id`,`santri_id`);--> statement-breakpoint
CREATE TABLE `guru` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`peran_guru` text DEFAULT 'Guru' NOT NULL,
	`kelas_id` text,
	`jenjang` text NOT NULL,
	`hp` text DEFAULT '' NOT NULL,
	`honor` integer DEFAULT 0 NOT NULL,
	`honor_lunas` integer DEFAULT false NOT NULL,
	`user_id` text,
	FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guru_nama_unique` ON `guru` (`nama`);--> statement-breakpoint
CREATE TABLE `kelas` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`jenjang` text NOT NULL,
	`pengajar` text DEFAULT '' NOT NULL,
	`jadwal` text DEFAULT '' NOT NULL,
	`ruang` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lembaga` (
	`jenjang` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`nama_singkat` text NOT NULL,
	`pimpinan` text DEFAULT '' NOT NULL,
	`alamat` text DEFAULT '' NOT NULL,
	`telepon` text DEFAULT '' NOT NULL,
	`tahun_berdiri` integer,
	`nsm_npsn` text DEFAULT '' NOT NULL,
	`motto` text DEFAULT '' NOT NULL,
	`logo` text,
	`tarif_spp` integer DEFAULT 0 NOT NULL,
	`tahun_ajaran` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `nilai` (
	`id` text PRIMARY KEY NOT NULL,
	`santri_id` text NOT NULL,
	`jenis` text NOT NULL,
	`mapel` text NOT NULL,
	`nilai` integer NOT NULL,
	`tanggal` text NOT NULL,
	`semester` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`santri_id`) REFERENCES `santri`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nilai_santri_idx` ON `nilai` (`santri_id`);--> statement-breakpoint
CREATE TABLE `pengumuman` (
	`id` text PRIMARY KEY NOT NULL,
	`judul` text NOT NULL,
	`isi` text NOT NULL,
	`tampil` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pertemuan` (
	`id` text PRIMARY KEY NOT NULL,
	`kelas_id` text NOT NULL,
	`tanggal` text NOT NULL,
	`materi` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pertemuan_kelas_tgl_uq` ON `pertemuan` (`kelas_id`,`tanggal`);--> statement-breakpoint
CREATE TABLE `santri` (
	`id` text PRIMARY KEY NOT NULL,
	`nis` text NOT NULL,
	`nama` text NOT NULL,
	`jenis_kelamin` text NOT NULL,
	`jenjang` text NOT NULL,
	`kelas_id` text,
	`jilid` text DEFAULT 'Iqra 1' NOT NULL,
	`angkatan` text DEFAULT '' NOT NULL,
	`rombel` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'aktif' NOT NULL,
	`wali` text DEFAULT '' NOT NULL,
	`hp_wali` text DEFAULT '' NOT NULL,
	`alamat` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santri_nis_uq` ON `santri` (`nis`);--> statement-breakpoint
CREATE INDEX `santri_kelas_idx` ON `santri` (`kelas_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `setoran` (
	`id` text PRIMARY KEY NOT NULL,
	`santri_id` text NOT NULL,
	`jenis` text NOT NULL,
	`materi` text NOT NULL,
	`nilai` text NOT NULL,
	`tanggal` text NOT NULL,
	FOREIGN KEY (`santri_id`) REFERENCES `santri`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `setoran_santri_idx` ON `setoran` (`santri_id`);--> statement-breakpoint
CREATE TABLE `tabungan` (
	`id` text PRIMARY KEY NOT NULL,
	`santri_id` text NOT NULL,
	`jenis` text NOT NULL,
	`jumlah` integer NOT NULL,
	`tanggal` text NOT NULL,
	FOREIGN KEY (`santri_id`) REFERENCES `santri`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tabungan_santri_idx` ON `tabungan` (`santri_id`);--> statement-breakpoint
CREATE TABLE `tagihan_spp` (
	`id` text PRIMARY KEY NOT NULL,
	`santri_id` text NOT NULL,
	`periode` text NOT NULL,
	`jumlah` integer NOT NULL,
	`status` text DEFAULT 'belum' NOT NULL,
	FOREIGN KEY (`santri_id`) REFERENCES `santri`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spp_santri_periode_uq` ON `tagihan_spp` (`santri_id`,`periode`);--> statement-breakpoint
CREATE TABLE `transaksi` (
	`id` text PRIMARY KEY NOT NULL,
	`jenis` text NOT NULL,
	`jenjang` text NOT NULL,
	`kategori` text NOT NULL,
	`nama` text NOT NULL,
	`jumlah` integer NOT NULL,
	`tanggal` text NOT NULL,
	`tagihan_spp_id` text
);
--> statement-breakpoint
CREATE INDEX `transaksi_tgl_idx` ON `transaksi` (`tanggal`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`nama` text NOT NULL,
	`peran` text NOT NULL,
	`password_hash` text NOT NULL,
	`wajib_ganti_sandi` integer DEFAULT false NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`gagal_login` integer DEFAULT 0 NOT NULL,
	`terkunci_sampai` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);