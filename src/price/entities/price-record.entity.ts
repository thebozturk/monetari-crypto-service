import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('price_records')
@Index(['coinId', 'queriedAt'])
export class PriceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  coinId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  priceUsd!: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  priceEur!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  priceTry!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  marketCap!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  change24h!: number | null;

  @Column({ type: 'timestamp' })
  queriedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
